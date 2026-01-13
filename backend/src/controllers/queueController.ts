import { Request, Response, NextFunction } from 'express';
import { ReservationModel } from '../models/Reservation.js';
import { SessionModel } from '../models/Session.js';
import { FoodOrderModel } from '../models/Order.js';
import { ActivityModel, ActivityUnitModel } from '../models/Activity.js';
import { AppError } from '../middleware/errorHandler.js';

export const getQueue = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { service } = req.query;

    const pendingReservations = await ReservationModel.find({
      status: { $in: ['pending_payment', 'pending_approval', 'payment_confirmed'] },
    })
      .populate('activityId')
      .populate('unitId')
      .sort({ createdAt: 1 });
    
    const reservationsWithoutActiveSessions = [];
    for (const reservation of pendingReservations) {
      const activeSession = await SessionModel.findOne({
        reservationId: reservation._id,
        status: { $in: ['active', 'scheduled'] },
      });
      if (!activeSession || reservation.status === 'pending_approval') {
        reservationsWithoutActiveSessions.push(reservation);
      }
    }

    const activeSessions = await SessionModel.find({
      status: { $in: ['scheduled', 'active'] },
    })
      .populate('activityId')
      .populate('unitId')
      .sort({ startTime: 1 });

    const pendingOrders = await FoodOrderModel.find({
      status: { $in: ['pending', 'preparing', 'ready'] },
      paymentStatus: { $in: ['pending', 'paid', 'offline'] },
    })
      .sort({ createdAt: 1 });

    const reservationQueue = reservationsWithoutActiveSessions.map((reservation, index) => {
      const activity = reservation.activityId as any;
      const unit = reservation.unitId as any;
      
      const serviceType = mapActivityTypeToServiceType(activity?.type || '');
      
      const queueStatus = reservation.status === 'pending_approval' 
        ? ('pending' as const) 
        : reservation.status === 'payment_confirmed'
        ? ('waiting' as const)
        : ('waiting' as const);
      
      return {
        id: reservation._id.toString(),
        name: reservation.customerName,
        phone: reservation.customerPhone,
        service: serviceType,
        joinedAt: reservation.createdAt,
        status: queueStatus,
        position: index + 1,
        type: 'reservation',
        activityName: activity?.name || 'Unknown Activity',
        unitName: unit?.name || 'Unknown Unit',
        amount: reservation.amount,
        expiresAt: reservation.expiresAt,
        reservationStatus: reservation.status,
        reservationId: reservation._id.toString(),
        paymentStatus: reservation.status === 'pending_approval' ? 'offline' : 
                      reservation.status === 'payment_confirmed' ? 'paid' : 'pending',
      };
    });

    const sessionQueue = activeSessions.map((session, index) => {
      const activity = session.activityId as any;
      const unit = session.unitId as any;
      
      const serviceType = mapActivityTypeToServiceType(activity?.type || session.activityType || '');
      
      return {
        id: session._id.toString(),
        name: session.customerName,
        phone: session.customerPhone,
        service: serviceType,
        joinedAt: session.startTime,
        status: session.status === 'active' ? ('serving' as const) : ('next' as const),
        position: reservationQueue.length + index + 1,
        type: 'session',
        activityName: activity?.name || 'Unknown Activity',
        unitName: unit?.name || 'Unknown Unit',
        amount: session.baseAmount || session.amount || 0,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.durationMinutes || session.duration,
      };
    });

    const orderQueue = pendingOrders.map((order, index) => {
      const queueStatus = (order.status === 'preparing' || order.status === 'ready') 
        ? ('next' as const) 
        : ('waiting' as const);
      
      return {
        id: order._id.toString(),
        name: order.customerName,
        phone: order.customerPhone,
        service: 'general' as const,
        joinedAt: order.createdAt,
        status: queueStatus,
        position: reservationQueue.length + sessionQueue.length + index + 1,
        type: 'order',
        itemCount: order.items?.length || 0,
        amount: order.totalAmount || order.amount || 0,
        items: order.items || [],
        orderStatus: order.status,
        paymentStatus: order.paymentStatus,
      };
    });

    let allQueue = [...reservationQueue, ...sessionQueue, ...orderQueue];

    if (service && service !== 'all') {
      allQueue = allQueue.filter(entry => entry.service === service);
    }

    allQueue = allQueue.map((entry, index) => ({
      ...entry,
      position: index + 1,
    }));

    res.json({
      queue: allQueue,
      stats: {
        total: allQueue.length,
        waiting: allQueue.filter(e => e.status === 'waiting').length,
        pending: allQueue.filter(e => e.status === 'pending').length,
        next: allQueue.filter(e => e.status === 'next').length,
        serving: allQueue.filter(e => e.status === 'serving').length,
        byService: {
          playstation: allQueue.filter(e => e.service === 'playstation').length,
          snooker: allQueue.filter(e => e.service === 'snooker').length,
          racing: allQueue.filter(e => e.service === 'racing').length,
          general: allQueue.filter(e => e.service === 'general').length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getStations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { type } = req.query;

    const units = await ActivityUnitModel.find()
      .populate('activityId')
      .sort({ name: 1 });

    const activeSessions = await SessionModel.find({
      status: 'active',
    })
      .populate('activityId')
      .populate('unitId');

    const unitSessionMap = new Map();
    activeSessions.forEach(session => {
      const unitId = (session.unitId as any)?._id?.toString();
      if (unitId) {
        unitSessionMap.set(unitId, session);
      }
    });

    const stations = units
      .filter(unit => {
        if (!type || type === 'all') return true;
        const activity = unit.activityId as any;
        const serviceType = mapActivityTypeToServiceType(activity?.type || '');
        return serviceType === type;
      })
      .map(unit => {
        const activity = unit.activityId as any;
        const session = unitSessionMap.get(unit._id.toString());
        const serviceType = mapActivityTypeToServiceType(activity?.type || '');

        return {
          id: unit._id.toString(),
          name: unit.name,
          type: serviceType,
          status: unit.status === 'occupied' ? 'occupied' : 'available',
          currentCustomer: session
            ? {
                name: session.customerName,
                phone: session.customerPhone,
                startTime: session.actualStartTime || session.startTime,
              }
            : undefined,
          rate: activity?.baseRate || 0,
        };
      });

    res.json({ stations });
  } catch (error) {
    next(error);
  }
};

export const getQueueStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeSessions = await SessionModel.countDocuments({
      status: 'active',
    });

    const pendingReservations = await ReservationModel.countDocuments({
      status: 'pending_payment',
    });

    const pendingOrders = await FoodOrderModel.countDocuments({
      status: { $in: ['pending', 'preparing', 'ready'] },
    });

    const todaySessions = await SessionModel.find({
      createdAt: { $gte: today },
      paymentStatus: { $in: ['paid', 'offline'] },
    });
    const todayRevenue = todaySessions.reduce(
      (sum, session) => sum + (session.finalAmount || session.baseAmount || session.amount || 0),
      0
    );

    const servedToday = await SessionModel.countDocuments({
      status: 'ended',
      actualEndTime: { $gte: today },
    });

    const inQueue = pendingReservations + pendingOrders;

    res.json({
      activeNow: activeSessions,
      todayRevenue,
      servedToday,
      inQueue,
      avgWaitTime: 15,
    });
  } catch (error) {
    next(error);
  }
};

export const assignQueueEntry = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id, entryId, type } = req.body;
    const targetId = id || entryId; // Support both parameter names

    if (!targetId || !type) {
      throw new AppError('Entry ID and type are required', 400);
    }

    let result: any = {};

    if (type === 'reservation') {
      const reservation = await ReservationModel.findById(targetId)
        .populate('activityId')
        .populate('unitId');

      if (!reservation) {
        throw new AppError('Reservation not found', 404);
      }

      if (reservation.status !== 'pending_payment' && reservation.status !== 'pending_approval' && reservation.status !== 'payment_confirmed') {
        throw new AppError('Reservation is not in a valid state for assignment', 400);
      }

      const existingSession = await SessionModel.findOne({
        reservationId: reservation._id,
        status: { $in: ['active', 'scheduled'] },
      });

      if (existingSession) {
        throw new AppError('Session is already active for this reservation', 400);
      }

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
      
      const unit = reservation.unitId as any;
      const unitId = unit._id || unit;

      reservation.activityId = activityId;
      reservation.unitId = unitId;
      reservation.status = 'payment_confirmed';
      reservation.paymentId = 'admin_assigned';
      reservation.confirmedAt = new Date();
      await reservation.save();

      const session = await SessionModel.create({
        reservationId: reservation._id,
        activityId: activityId,
        activityType: activityType,
        unitId: unitId,
        startTime: new Date(),
        endTime: new Date(Date.now() + reservation.durationMinutes * 60 * 1000),
        durationMinutes: reservation.durationMinutes,
        duration: reservation.durationMinutes,
        baseAmount: reservation.amount,
        amount: reservation.amount,
        status: 'active',
        actualStartTime: new Date(),
        customerName: reservation.customerName,
        customerPhone: reservation.customerPhone,
        qrContext: reservation.qrContext,
        paymentStatus: 'offline',
      });

      await ActivityUnitModel.findByIdAndUpdate(unitId, {
        status: 'occupied',
      });

      result = {
        type: 'reservation',
        reservationId: reservation._id.toString(),
        sessionId: session._id.toString(),
        customerPhone: reservation.customerPhone,
        message: 'Reservation confirmed and session started',
      };

      // Broadcast to WebSocket - notify specific customer
      const { getIO, notifyCustomerByPhone, notifyCustomerById } = await import('../websocket/server.js');
      const io = getIO();
      
      // Notify by phone and by reservation ID
      notifyCustomerByPhone(reservation.customerPhone, 'booking_status_update', {
        type: 'reservation',
        reservationId: reservation._id.toString(),
        sessionId: session._id.toString(),
        status: 'confirmed',
        message: 'Your booking has been confirmed! Your session has started.',
        timestamp: new Date().toISOString(),
      });
      
      notifyCustomerById(reservation._id.toString(), 'reservation', 'booking_status_update', {
        type: 'reservation',
        reservationId: reservation._id.toString(),
        sessionId: session._id.toString(),
        status: 'confirmed',
        message: 'Your booking has been confirmed! Your session has started.',
        timestamp: new Date().toISOString(),
      });
      
      io.of('/admin').emit('queue_updated', { action: 'assigned', entryId: targetId, type });

    } else if (type === 'order') {
      const order = await FoodOrderModel.findById(targetId);

      if (!order) {
        throw new AppError('Order not found', 404);
      }

      if (order.status === 'cancelled' || order.status === 'served') {
        throw new AppError(`Order is already ${order.status}`, 400);
      }

      let statusMessage = '';
      if (order.status === 'pending') {
        order.status = 'preparing';
        statusMessage = 'Order is now being prepared';
      } else if (order.status === 'preparing') {
        order.status = 'ready';
        statusMessage = 'Order is ready for pickup';
      } else if (order.status === 'ready') {
        order.status = 'served';
        statusMessage = 'Order has been served';
      }
      await order.save();

      result = {
        type: 'order',
        orderId: order._id.toString(),
        customerPhone: order.customerPhone,
        message: statusMessage || 'Order status updated',
        orderStatus: order.status,
      };

      const { getIO, notifyCustomerByPhone, notifyCustomerById } = await import('../websocket/server.js');
      const io = getIO();
      
      const customerMessage = order.status === 'preparing' 
        ? 'Your order is now being prepared!'
        : order.status === 'ready'
        ? 'Your order is ready for pickup!'
        : 'Your order has been served!';
      
      notifyCustomerByPhone(order.customerPhone, 'order_status_update', {
        type: 'order',
        orderId: order._id.toString(),
        status: order.status,
        message: customerMessage,
        timestamp: new Date().toISOString(),
      });
      
      notifyCustomerById(order._id.toString(), 'order', 'order_status_update', {
        type: 'order',
        orderId: order._id.toString(),
        status: order.status,
        message: customerMessage,
        timestamp: new Date().toISOString(),
      });
      
      io.of('/admin').emit('queue_updated', { action: 'assigned', entryId: targetId, type });

    } else if (type === 'session') {
      const session = await SessionModel.findById(targetId);

      if (!session) {
        throw new AppError('Session not found', 404);
      }

      if (session.status === 'active') {
        throw new AppError('Session is already active', 400);
      }

      session.status = 'active';
      session.actualStartTime = new Date();
      await session.save();

      await ActivityUnitModel.findByIdAndUpdate(session.unitId, {
        status: 'occupied',
      });

      result = {
        type: 'session',
        sessionId: session._id.toString(),
        customerPhone: session.customerPhone,
        message: 'Session activated',
      };

      // Broadcast to WebSocket - notify specific customer
      const { getIO, notifyCustomerByPhone, notifyCustomerById } = await import('../websocket/server.js');
      const io = getIO();
      
      // Notify by phone and by session ID
      notifyCustomerByPhone(session.customerPhone, 'session_status_update', {
        type: 'session',
        sessionId: session._id.toString(),
        status: 'active',
        message: 'Your session has started!',
        timestamp: new Date().toISOString(),
      });
      
      notifyCustomerById(session._id.toString(), 'session', 'session_status_update', {
        type: 'session',
        sessionId: session._id.toString(),
        status: 'active',
        message: 'Your session has started!',
        timestamp: new Date().toISOString(),
      });
      
      io.of('/admin').emit('queue_updated', { action: 'assigned', entryId: targetId, type });
    } else {
      throw new AppError('Invalid entry type', 400);
    }

    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const removeQueueEntry = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id, entryId, type } = req.body;
    const targetId = id || entryId; // Support both parameter names

    if (!targetId || !type) {
      throw new AppError('Entry ID and type are required', 400);
    }

    let result: any = {};

    if (type === 'reservation') {
      const reservation = await ReservationModel.findById(targetId);

      if (!reservation) {
        throw new AppError('Reservation not found', 404);
      }

      reservation.status = 'cancelled';
      await reservation.save();

      if (reservation.unitId) {
        const unit = await ActivityUnitModel.findById(reservation.unitId);
        if (unit && unit.status === 'reserved') {
          unit.status = 'available';
          await unit.save();
        }
      }

      result = {
        type: 'reservation',
        reservationId: reservation._id.toString(),
        customerPhone: reservation.customerPhone,
        message: 'Reservation cancelled',
      };

      // Broadcast to WebSocket - notify specific customer
      const { getIO, notifyCustomerByPhone, notifyCustomerById } = await import('../websocket/server.js');
      const io = getIO();
      
      // Notify by phone and by reservation ID
      notifyCustomerByPhone(reservation.customerPhone, 'booking_status_update', {
        type: 'reservation',
        reservationId: reservation._id.toString(),
        status: 'cancelled',
        message: 'Your reservation has been cancelled.',
        timestamp: new Date().toISOString(),
      });
      
      notifyCustomerById(reservation._id.toString(), 'reservation', 'booking_status_update', {
        type: 'reservation',
        reservationId: reservation._id.toString(),
        status: 'cancelled',
        message: 'Your reservation has been cancelled.',
        timestamp: new Date().toISOString(),
      });
      
      io.of('/admin').emit('queue_updated', { action: 'removed', entryId: targetId, type });

    } else if (type === 'order') {
      const order = await FoodOrderModel.findById(targetId);

      if (!order) {
        throw new AppError('Order not found', 404);
      }

      order.status = 'cancelled';
      await order.save();

      result = {
        type: 'order',
        orderId: order._id.toString(),
        customerPhone: order.customerPhone,
        message: 'Order cancelled',
      };

      const { getIO, notifyCustomerByPhone, notifyCustomerById } = await import('../websocket/server.js');
      const io = getIO();
      
      notifyCustomerByPhone(order.customerPhone, 'order_status_update', {
        type: 'order',
        orderId: order._id.toString(),
        status: 'cancelled',
        message: 'Your order has been cancelled.',
        timestamp: new Date().toISOString(),
      });
      
      notifyCustomerById(order._id.toString(), 'order', 'order_status_update', {
        type: 'order',
        orderId: order._id.toString(),
        status: 'cancelled',
        message: 'Your order has been cancelled.',
        timestamp: new Date().toISOString(),
      });
      
      io.of('/admin').emit('queue_updated', { action: 'removed', entryId: targetId, type });

    } else if (type === 'session') {
      const session = await SessionModel.findById(targetId);

      if (!session) {
        throw new AppError('Session not found', 404);
      }

      session.status = 'ended';
      session.actualEndTime = new Date();
      await session.save();

      await ActivityUnitModel.findByIdAndUpdate(session.unitId, {
        status: 'available',
      });

      result = {
        type: 'session',
        sessionId: session._id.toString(),
        customerPhone: session.customerPhone,
        message: 'Session ended',
      };

      // Broadcast to WebSocket - notify specific customer
      const { getIO, notifyCustomerByPhone, notifyCustomerById } = await import('../websocket/server.js');
      const io = getIO();
      
      // Notify by phone and by session ID
      notifyCustomerByPhone(session.customerPhone, 'session_status_update', {
        type: 'session',
        sessionId: session._id.toString(),
        status: 'ended',
        message: 'Your session has been ended.',
        timestamp: new Date().toISOString(),
      });
      
      notifyCustomerById(session._id.toString(), 'session', 'session_status_update', {
        type: 'session',
        sessionId: session._id.toString(),
        status: 'ended',
        message: 'Your session has been ended.',
        timestamp: new Date().toISOString(),
      });
      
      io.of('/admin').emit('queue_updated', { action: 'removed', entryId: targetId, type });
    } else {
      throw new AppError('Invalid entry type', 400);
    }

    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

function mapActivityTypeToServiceType(activityType: string): 'playstation' | 'snooker' | 'racing' | 'general' {
  if (activityType.includes('playstation')) return 'playstation';
  if (activityType.includes('snooker')) return 'snooker';
  if (activityType.includes('racing')) return 'racing';
  return 'general';
}

