import { Request, Response, NextFunction } from 'express';
import { ReservationModel } from '../models/Reservation.js';
import { WaitingQueueModel } from '../models/WaitingQueue.js';
import { ActivityModel, ActivityUnitModel } from '../models/Activity.js';
import { SessionModel } from '../models/Session.js';
import { AppError } from '../middleware/errorHandler.js';
import { redisUtils } from '../config/redis.js';
import { findAvailableUnit, processWaitingQueue, getQueueStatus } from '../lib/queueManager.js';
import { broadcastSessionEvent, broadcastAvailabilityChange } from '../websocket/server.js';

export const getPendingApprovals = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const reservations = await ReservationModel.find({
      status: 'pending_approval',
    })
      .populate('activityId', 'name type')
      .populate('unitId', 'name status')
      .sort({ createdAt: -1 });

    res.json(reservations.map(r => ({
      id: r._id.toString(),
      activityId: r.activityId,
      unitId: r.unitId,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      amount: r.amount,
      durationMinutes: r.durationMinutes,
      startTime: r.startTime,
      endTime: r.endTime,
      createdAt: r.createdAt,
      qrContext: r.qrContext,
    })));
  } catch (error) {
    next(error);
  }
};

export const approveCashPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { reservationId, unitId } = req.body;

    if (!reservationId) {
      throw new AppError('Reservation ID is required', 400);
    }

    const reservation = await ReservationModel.findById(reservationId)
      .populate('activityId')
      .populate('unitId');

    if (!reservation) {
      throw new AppError('Reservation not found', 404);
    }

    const existingSession = await SessionModel.findOne({
      reservationId: reservation._id,
      status: { $in: ['active', 'scheduled', 'paused'] },
    });

    if (existingSession) {
      res.json({
        success: true,
        message: 'Reservation already approved and session is active',
        reservationId: reservation._id.toString(),
        sessionId: existingSession._id.toString(),
      });
      return;
    }

    if (reservation.status !== 'pending_approval') {
      throw new AppError('Reservation is not pending approval', 400);
    }

    let assignedUnitId = unitId || reservation.unitId;
    
    if (unitId) {
      const unit = await ActivityUnitModel.findById(unitId);
      if (!unit) {
        throw new AppError('Unit not found', 404);
      }
      if (unit.status !== 'available') {
        throw new AppError('Unit is not available', 400);
      }
    } else {
      const activityIdForSearch = (reservation.activityId as any)?._id?.toString() || reservation.activityId?.toString();
      const availableUnit = await findAvailableUnit(activityIdForSearch);
      if (!availableUnit) {
        throw new AppError('No units available for this activity', 400);
      }
      assignedUnitId = availableUnit._id;
    }

    const activityIdForReservation = (reservation.activityId as any)?._id || reservation.activityId;
    
    reservation.activityId = activityIdForReservation;
    reservation.status = 'payment_confirmed';
    reservation.unitId = assignedUnitId;
    reservation.paymentId = 'offline';
    reservation.confirmedAt = new Date();
    await reservation.save();

    await redisUtils.delete(`reservation:${reservation._id}`);

    let activity: any;
    let activityId: any;
    let activityType: string;
    
    const populatedActivity = reservation.activityId as any;
    if (populatedActivity && populatedActivity._id) {
      activityId = populatedActivity._id;
      activityType = populatedActivity.type;
      if (!activityType) {
        activity = await ActivityModel.findById(activityId);
        if (!activity) {
          throw new AppError('Activity not found', 404);
        }
        activityType = activity.type;
      } else {
        activity = populatedActivity;
      }
    } else {
      activityId = reservation.activityId;
      activity = await ActivityModel.findById(activityId);
      if (!activity) {
        throw new AppError('Activity not found', 404);
      }
      activityType = activity.type;
    }

    if (!activityType) {
      throw new AppError('Activity type is required', 400);
    }

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + reservation.durationMinutes * 60 * 1000);

    const session = await SessionModel.create({
      reservationId: reservation._id,
      activityId: activityId,
      activityType: activityType,
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
      paymentStatus: 'offline',
    });

    await ActivityUnitModel.findByIdAndUpdate(assignedUnitId, {
      status: 'occupied',
    });

    const queueEntry = await WaitingQueueModel.findOne({
      reservationId: reservation._id,
      status: 'waiting',
    });

    if (queueEntry) {
      queueEntry.status = 'assigned';
      queueEntry.assignedAt = new Date();
      queueEntry.sessionId = session._id;
      await queueEntry.save();
    }

    await redisUtils.setSessionState(session._id.toString(), {
      status: 'active',
      started_at: startTime.getTime().toString(),
      elapsed_seconds: '0',
    });

    broadcastSessionEvent('booking_confirmed', {
      reservation_id: reservation._id.toString(),
      session_id: session._id.toString(),
    });

    broadcastAvailabilityChange(reservation.activityId.toString(), 'occupied');

    const { getIO, notifyCustomerByPhone } = await import('../websocket/server.js');
    const io = getIO();
    if (io) {
      notifyCustomerByPhone(reservation.customerPhone, 'session_started', {
        session_id: session._id.toString(),
        reservation_id: reservation._id.toString(),
        activity_id: activityId.toString(),
        start_time: startTime.toISOString(),
      });

      notifyCustomerByPhone(reservation.customerPhone, 'booking_approved', {
        reservationId: reservation._id.toString(),
        sessionId: session._id.toString(),
        status: 'payment_confirmed',
        message: 'Your booking has been approved! Your session has started.',
        timestamp: new Date().toISOString(),
      });

      notifyCustomerByPhone(reservation.customerPhone, 'booking_status_update', {
        reservationId: reservation._id.toString(),
        sessionId: session._id.toString(),
        status: 'payment_confirmed',
        message: 'Your booking has been approved and session has started.',
        timestamp: new Date().toISOString(),
      });

      io.of('/admin').emit('approval_processed', {
        reservationId: reservation._id.toString(),
        sessionId: session._id.toString(),
        status: 'payment_confirmed',
        action: 'approved',
      });

      io.of('/admin').emit('queue_updated', {
        action: 'approved',
        reservationId: reservation._id.toString(),
        sessionId: session._id.toString(),
      });
    }

    res.json({
      success: true,
      message: 'Payment approved and session started',
      reservationId: reservation._id.toString(),
      sessionId: session._id.toString(),
    });
  } catch (error) {
    next(error);
  }
};

export const rejectCashPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { reservationId } = req.body;

    if (!reservationId) {
      throw new AppError('Reservation ID is required', 400);
    }

    const reservation = await ReservationModel.findById(reservationId);

    if (!reservation) {
      throw new AppError('Reservation not found', 404);
    }

    if (reservation.status !== 'pending_approval') {
      throw new AppError('Reservation is not pending approval', 400);
    }

    reservation.status = 'cancelled';
    await reservation.save();

    await redisUtils.delete(`reservation:${reservation._id}`);

    const { getIO, notifyCustomerByPhone } = await import('../websocket/server.js');
    const io = getIO();
    if (io) {
      notifyCustomerByPhone(reservation.customerPhone, 'booking_rejected', {
        reservationId: reservation._id.toString(),
        status: 'rejected',
        message: 'Your booking request has been rejected. Please contact support.',
        timestamp: new Date().toISOString(),
      });

      io.of('/admin').emit('approval_processed', {
        reservationId: reservation._id.toString(),
        action: 'rejected',
      });
    }

    res.json({
      success: true,
      message: 'Payment rejected',
      reservationId: reservation._id.toString(),
    });
  } catch (error) {
    next(error);
  }
};

export const getWaitingQueue = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { activityId } = req.query;

    const query: any = {
      status: 'waiting',
    };

    if (activityId) {
      query.activityId = activityId;
    }

    const queue = await WaitingQueueModel.find(query)
      .populate('activityId', 'name type')
      .populate('reservationId')
      .sort({ position: 1 });

    res.json(queue.map(q => ({
      id: q._id.toString(),
      reservationId: q.reservationId.toString(),
      activityId: q.activityId,
      customerName: q.customerName,
      customerPhone: q.customerPhone,
      durationMinutes: q.durationMinutes,
      amount: q.amount,
      paymentStatus: q.paymentStatus,
      position: q.position,
      status: q.status,
      createdAt: q.createdAt,
      qrContext: q.qrContext,
    })));
  } catch (error) {
    next(error);
  }
};

export const processQueue = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { activityId } = req.body;

    if (!activityId) {
      throw new AppError('Activity ID is required', 400);
    }

    await processWaitingQueue(activityId);

    res.json({
      success: true,
      message: 'Queue processed',
    });
  } catch (error) {
    next(error);
  }
};

export const getQueueStatusByReservation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { reservationId } = req.params;

    if (!reservationId) {
      throw new AppError('Reservation ID is required', 400);
    }

    const status = await getQueueStatus(reservationId);

    if (!status) {
      res.json({
        inQueue: false,
        message: 'Not in waiting queue',
      });
      return;
    }

    res.json({
      inQueue: true,
      ...status,
    });
  } catch (error) {
    next(error);
  }
};
