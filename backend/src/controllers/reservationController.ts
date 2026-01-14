import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { ReservationModel } from '../models/Reservation.js';
import { SessionModel } from '../models/Session.js';
import { WaitingQueueModel } from '../models/WaitingQueue.js';
import { ActivityModel, ActivityUnitModel } from '../models/Activity.js';
import { AppError } from '../middleware/errorHandler.js';
import { redisUtils } from '../config/redis.js';
import { calculateActivityPrice, isPeakHour } from '../lib/pricing.js';
import { broadcastAvailabilityChange } from '../websocket/server.js';

export const createReservation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { activityId, unitId, startTime, duration, customerName, customerPhone, qrContext } = req.body;

    let activity;
    if (mongoose.Types.ObjectId.isValid(activityId)) {
      activity = await ActivityModel.findById(activityId);
    } else {
      activity = await ActivityModel.findOne({ type: activityId });
    }
    
    if (!activity || !activity.enabled) {
      throw new AppError('Activity not found or disabled', 404);
    }

    let unit;
    if (mongoose.Types.ObjectId.isValid(unitId)) {
      unit = await ActivityUnitModel.findById(unitId);
    } else {
      unit = await ActivityUnitModel.findOne({
        name: unitId,
        activityId: activity._id,
      });
    }
    
    if (!unit || unit.status !== 'available') {
      throw new AppError('Unit not available', 400);
    }

    const start = new Date(startTime || new Date());
    const end = new Date(start.getTime() + duration * 60000);

    if (duration < activity.minimumDuration) {
      throw new AppError(`Minimum duration is ${activity.minimumDuration} minutes`, 400);
    }

    const peak = isPeakHour(start);
    const price = calculateActivityPrice(activity, duration, peak);

    const lockKey = `lock:${activity._id}:${unit._id}:${start.toISOString()}`;
    const lockValue = uuidv4();
    
    const lockAcquired = await redisUtils.acquireLock(lockKey, lockValue, 10);
    if (!lockAcquired) {
      throw new AppError('This slot is being booked by another customer. Please try again.', 409);
    }

    try {
      const conflicts = await SessionModel.find({
        unitId: unit._id,
        status: { $in: ['scheduled', 'active', 'paused'] },
        $or: [
          {
            startTime: { $lt: end },
            endTime: { $gt: start },
          },
        ],
      });

      const pendingReservations = await ReservationModel.find({
        unitId: unit._id,
        status: { $in: ['pending_payment', 'payment_confirmed'] },
        $or: [
          {
            startTime: { $lt: end },
            endTime: { $gt: start },
          },
        ],
      });

      if (conflicts.length > 0 || pendingReservations.length > 0) {
        await redisUtils.releaseLock(lockKey);
        throw new AppError('This time slot is already booked', 409);
      }

      const expiresAt = new Date(Date.now() + 15 * 60000);
      const reservation = await ReservationModel.create({
        activityId: activity._id,
        unitId: unit._id,
        startTime: start,
        endTime: end,
        durationMinutes: duration,
        amount: price,
        status: 'pending_payment',
        customerName: customerName.trim(),
        customerPhone: customerPhone.replace(/\D/g, ''),
        qrContext: qrContext || {},
        expiresAt,
      });

      await redisUtils.setCache(`reservation:${reservation._id}`, reservation.toObject(), 900);

      await redisUtils.releaseLock(lockKey);

      broadcastAvailabilityChange(activity._id.toString(), 'pending');

      const { getIO } = await import('../websocket/server.js');
      const io = getIO();
      if (io) {
        io.of('/admin').emit('booking_created', {
          reservationId: reservation._id.toString(),
          activityId: activity.type,
          activityName: activity.name,
          customerName: reservation.customerName,
          customerPhone: reservation.customerPhone,
          amount: reservation.amount,
          duration: reservation.durationMinutes,
          qrContext: reservation.qrContext,
          timestamp: new Date().toISOString(),
        });
      }

      res.status(201).json({
        id: reservation._id.toString(),
        activityId: activity.type,
        unitId: unit._id.toString(),
        startTime: reservation.startTime,
        endTime: reservation.endTime,
        durationMinutes: reservation.durationMinutes,
        amount: reservation.amount,
        status: reservation.status,
        expiresAt: reservation.expiresAt,
      });
    } catch (error) {
      await redisUtils.releaseLock(lockKey);
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

export const confirmReservation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { reservationId, paymentId, unitId } = req.body;

    const reservation = await ReservationModel.findById(reservationId);
    if (!reservation) {
      throw new AppError('Reservation not found', 404);
    }

    if (reservation.status !== 'pending_payment' && reservation.status !== 'pending_approval' && reservation.status !== 'payment_confirmed') {
      throw new AppError('Reservation is not in a valid state for confirmation', 400);
    }

    const activityIdForLookup = (reservation.activityId as any)?._id || reservation.activityId;
    const activity = await ActivityModel.findById(activityIdForLookup);
    if (!activity) {
      throw new AppError('Activity not found', 404);
    }

    let assignedUnitId = unitId || reservation.unitId;

    if (!assignedUnitId) {
      const { findAvailableUnit } = await import('../lib/queueManager.js');
      const availableUnit = await findAvailableUnit(activityIdForLookup.toString());
      if (!availableUnit) {
        throw new AppError('No units available. Please wait for a unit to become available.', 400);
      }
      assignedUnitId = availableUnit._id;
    }

    const unit = await ActivityUnitModel.findById(assignedUnitId);
    if (!unit) {
      throw new AppError('Unit not found', 404);
    }
    if (unit.status !== 'available') {
      throw new AppError('Unit is not available', 400);
    }

    reservation.status = 'payment_confirmed';
    reservation.paymentId = paymentId;
    reservation.unitId = assignedUnitId;
    reservation.confirmedAt = new Date();
    await reservation.save();

    await redisUtils.delete(`reservation:${reservation._id}`);

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + reservation.durationMinutes * 60 * 1000);

    const session = await SessionModel.create({
      reservationId: reservation._id,
      activityId: activity._id,
      activityType: activity.type,
      unitId: assignedUnitId,
      startTime,
      endTime,
      durationMinutes: reservation.durationMinutes,
      duration: reservation.durationMinutes,
      baseAmount: reservation.amount,
      amount: reservation.amount,
      status: 'active',
      actualStartTime: startTime,
      customerName: reservation.customerName,
      customerPhone: reservation.customerPhone,
      qrContext: reservation.qrContext,
      paymentStatus: paymentId === 'offline' ? 'offline' : 'paid',
    });

    await ActivityUnitModel.findByIdAndUpdate(assignedUnitId, {
      status: 'occupied',
    });

    const queueEntry = await WaitingQueueModel.findOne({
      reservationId: reservation._id,
      status: { $in: ['waiting', 'processing'] },
    });

    if (queueEntry) {
      queueEntry.status = 'assigned';
      queueEntry.assignedAt = new Date();
      queueEntry.sessionId = session._id;
      await queueEntry.save();

      const { reorderQueuePositions } = await import('../lib/queueManager.js');
      await reorderQueuePositions(activityIdForLookup.toString());
    }

    const { broadcastSessionEvent, getIO, notifyCustomerByPhone } = await import('../websocket/server.js');
    const io = getIO();
    if (io) {
      notifyCustomerByPhone(reservation.customerPhone, 'session_started', {
        session_id: session._id.toString(),
        reservation_id: reservation._id.toString(),
        activity_id: activity._id.toString(),
        start_time: session.startTime.toISOString(),
      });
    }

    broadcastSessionEvent('booking_confirmed', {
      reservation_id: reservation._id.toString(),
      session_id: session._id.toString(),
    });

    broadcastAvailabilityChange(reservation.activityId.toString(), 'occupied');

    res.json({
      reservationId: reservation._id.toString(),
      sessionId: session._id.toString(),
      status: 'confirmed',
    });
  } catch (error) {
    next(error);
  }
};

export const joinWaitingQueue = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { activityId, duration, customerName, customerPhone, qrContext, paymentId, paymentStatus } = req.body;

    let activity;
    if (mongoose.Types.ObjectId.isValid(activityId)) {
      activity = await ActivityModel.findById(activityId);
    } else {
      activity = await ActivityModel.findOne({ type: activityId });
    }
    
    if (!activity || !activity.enabled) {
      throw new AppError('Activity not found or disabled', 404);
    }

    const availableUnits = await ActivityUnitModel.find({
      activityId: activity._id,
      status: 'available',
    });

    if (availableUnits.length > 0) {
      throw new AppError('Units are available. Please book directly.', 400);
    }

    if (duration < activity.minimumDuration) {
      throw new AppError(`Minimum duration is ${activity.minimumDuration} minutes`, 400);
    }

    const peak = isPeakHour();
    const price = calculateActivityPrice(activity, duration, peak);

    const reservation = await ReservationModel.create({
      activityId: activity._id,
      unitId: null,
      startTime: new Date(),
      endTime: new Date(Date.now() + duration * 60000),
      durationMinutes: duration,
      amount: price,
      status: paymentStatus === 'offline' ? 'pending_approval' : 'payment_confirmed',
      customerName: customerName.trim(),
      customerPhone: customerPhone.replace(/\D/g, ''),
      qrContext: qrContext || {},
      paymentId: paymentId || 'queue',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const { addToWaitingQueue } = await import('../lib/queueManager.js');
    const queueEntry = await addToWaitingQueue(
      reservation._id.toString(),
      activity._id.toString(),
      customerName.trim(),
      customerPhone.replace(/\D/g, ''),
      duration,
      price,
      paymentId || 'queue',
      paymentStatus || 'offline',
      qrContext
    );

    const { getIO, notifyCustomerByPhone } = await import('../websocket/server.js');
    const io = getIO();
    if (io) {
      notifyCustomerByPhone(customerPhone.replace(/\D/g, ''), 'queue_joined', {
        reservationId: reservation._id.toString(),
        queuePosition: queueEntry.position,
        activityId: activity._id.toString(),
        activityName: activity.name,
        message: `You are #${queueEntry.position} in the waiting queue`,
        timestamp: new Date().toISOString(),
      });

      io.of('/admin').emit('queue_updated', {
        action: 'added',
        queueEntry: queueEntry.toObject(),
      });
    }

    res.status(201).json({
      reservationId: reservation._id.toString(),
      queuePosition: queueEntry.position,
      activityId: activity.type,
      activityName: activity.name,
      amount: price,
      duration,
      status: 'waiting',
    });
  } catch (error) {
    next(error);
  }
};

export const exitWaitingQueue = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { reservationId } = req.body;

    const reservation = await ReservationModel.findById(reservationId);
    if (!reservation) {
      throw new AppError('Reservation not found', 404);
    }

    const queueEntry = await WaitingQueueModel.findOne({
      reservationId: reservation._id,
      status: 'waiting',
    });

    if (queueEntry) {
      queueEntry.status = 'cancelled';
      await queueEntry.save();
    }

    reservation.status = 'cancelled';
    await reservation.save();

    const { getIO, notifyCustomerByPhone } = await import('../websocket/server.js');
    const io = getIO();
    if (io) {
      notifyCustomerByPhone(reservation.customerPhone, 'queue_exited', {
        reservationId: reservation._id.toString(),
        message: 'You have exited the waiting queue',
        timestamp: new Date().toISOString(),
      });

      io.of('/admin').emit('queue_updated', {
        action: 'exited',
        reservationId: reservation._id.toString(),
        customerPhone: reservation.customerPhone,
      });
    }

    res.json({
      success: true,
      message: 'Exited waiting queue successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getReservation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const reservation = await ReservationModel.findById(id).populate('activityId unitId');

    if (!reservation) {
      throw new AppError('Reservation not found', 404);
    }

    res.json({
      id: reservation._id.toString(),
      activityId: (reservation.activityId as any).type,
      unitId: reservation.unitId?.toString(),
      startTime: reservation.startTime,
      endTime: reservation.endTime,
      durationMinutes: reservation.durationMinutes,
      amount: reservation.amount,
      status: reservation.status,
      expiresAt: reservation.expiresAt,
      customerName: reservation.customerName,
      customerPhone: reservation.customerPhone,
      paymentId: reservation.paymentId,
      confirmedAt: reservation.confirmedAt,
    });
  } catch (error) {
    next(error);
  }
};

