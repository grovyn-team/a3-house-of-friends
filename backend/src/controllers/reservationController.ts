import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { ReservationModel } from '../models/Reservation.js';
import { SessionModel } from '../models/Session.js';
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

    // Verify activity exists
    let activity;
    if (mongoose.Types.ObjectId.isValid(activityId)) {
      activity = await ActivityModel.findById(activityId);
    } else {
      activity = await ActivityModel.findOne({ type: activityId });
    }
    
    if (!activity || !activity.enabled) {
      throw new AppError('Activity not found or disabled', 404);
    }

    // Verify unit exists
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

    // Calculate times
    const start = new Date(startTime || new Date());
    const end = new Date(start.getTime() + duration * 60000);

    if (duration < activity.minimumDuration) {
      throw new AppError(`Minimum duration is ${activity.minimumDuration} minutes`, 400);
    }

    const peak = isPeakHour(start);
    const price = calculateActivityPrice(activity, duration, peak);

    // CRITICAL: Race condition prevention with Redis lock
    const lockKey = `lock:${activity._id}:${unit._id}:${start.toISOString()}`;
    const lockValue = uuidv4();
    
    const lockAcquired = await redisUtils.acquireLock(lockKey, lockValue, 10);
    if (!lockAcquired) {
      throw new AppError('This slot is being booked by another customer. Please try again.', 409);
    }

    try {
      // Check for conflicts in database
      const conflicts = await SessionModel.find({
        unitId: unit._id,
        status: { $in: ['scheduled', 'active'] },
        $or: [
          {
            startTime: { $lt: end },
            endTime: { $gt: start },
          },
        ],
      });

      // Also check pending reservations
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

      // Create reservation
      const expiresAt = new Date(Date.now() + 15 * 60000); // 15 minutes
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

      // Cache reservation
      await redisUtils.setCache(`reservation:${reservation._id}`, reservation.toObject(), 900);

      // Release lock
      await redisUtils.releaseLock(lockKey);

      // Broadcast availability change
      broadcastAvailabilityChange(activity._id.toString(), 'pending');

      // Emit booking_created event to admin
      const { getIO } = await import('../websocket/server.js');
      const io = getIO();
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

      res.status(201).json({
        id: reservation._id.toString(),
        activityId: activity.type, // Return type for frontend
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
    const { reservationId, paymentId } = req.body;

    const reservation = await ReservationModel.findById(reservationId);
    if (!reservation) {
      throw new AppError('Reservation not found', 404);
    }

    if (reservation.status !== 'pending_payment') {
      throw new AppError('Reservation is not in pending payment status', 400);
    }

    // Update reservation
    reservation.status = 'payment_confirmed';
    reservation.paymentId = paymentId;
    reservation.confirmedAt = new Date();
    await reservation.save();

    // Get activity to get activityType
    const activity = await ActivityModel.findById(reservation.activityId);
    if (!activity) {
      throw new AppError('Activity not found', 404);
    }

    // Create session from reservation
    const session = await SessionModel.create({
      reservationId: reservation._id,
      activityId: reservation.activityId,
      activityType: activity.type,
      unitId: reservation.unitId,
      startTime: reservation.startTime,
      endTime: reservation.endTime,
      durationMinutes: reservation.durationMinutes,
      duration: reservation.durationMinutes,
      baseAmount: reservation.amount,
      amount: reservation.amount,
      status: 'scheduled',
      customerName: reservation.customerName,
      customerPhone: reservation.customerPhone,
      qrContext: reservation.qrContext,
      paymentStatus: paymentId === 'offline' ? 'offline' : 'paid',
    });

    // Update unit status
    await ActivityUnitModel.findByIdAndUpdate(reservation.unitId, {
      status: 'occupied',
    });

    // Broadcast events
    const { broadcastSessionEvent } = await import('../websocket/server.js');
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
      unitId: reservation.unitId.toString(),
      startTime: reservation.startTime,
      endTime: reservation.endTime,
      durationMinutes: reservation.durationMinutes,
      amount: reservation.amount,
      status: reservation.status,
      expiresAt: reservation.expiresAt,
    });
  } catch (error) {
    next(error);
  }
};

