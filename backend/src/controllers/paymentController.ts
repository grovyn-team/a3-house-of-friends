import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { SessionModel } from '../models/Session.js';
import { FoodOrderModel } from '../models/Order.js';
import { ReservationModel } from '../models/Reservation.js';
import { ActivityUnitModel } from '../models/Activity.js';
import { AppError } from '../middleware/errorHandler.js';
import { broadcastSessionEvent, broadcastAvailabilityChange } from '../websocket/server.js';
import { confirmReservation } from './reservationController.js';

const getRazorpay = (): Razorpay => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new AppError('Razorpay credentials not configured', 500);
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

export const createPaymentOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { amount, type, entityId, customerName, customerPhone, customerEmail } = req.body;

    if (!amount || amount < 1) {
      throw new AppError('Invalid amount', 400);
    }

    if (!['reservation', 'session', 'order'].includes(type)) {
      throw new AppError('Invalid payment type', 400);
    }

    // Verify entity exists (handle both ObjectId and string IDs)
    if (type === 'reservation') {
      const reservation = mongoose.Types.ObjectId.isValid(entityId)
        ? await ReservationModel.findById(entityId)
        : await ReservationModel.findOne({ _id: new mongoose.Types.ObjectId(entityId) });
      if (!reservation) {
        throw new AppError('Reservation not found', 404);
      }
      if (reservation.status !== 'pending_payment') {
        throw new AppError('Reservation is not in pending payment status', 400);
      }
    } else if (type === 'session') {
      const session = mongoose.Types.ObjectId.isValid(entityId)
        ? await SessionModel.findById(entityId)
        : await SessionModel.findOne({ _id: new mongoose.Types.ObjectId(entityId) });
      if (!session) {
        throw new AppError('Session not found', 404);
      }
    } else if (type === 'order') {
      const order = mongoose.Types.ObjectId.isValid(entityId)
        ? await FoodOrderModel.findById(entityId)
        : await FoodOrderModel.findOne({ _id: new mongoose.Types.ObjectId(entityId) });
      if (!order) {
        throw new AppError('Order not found', 404);
      }
    }

    const razorpay = getRazorpay();

    const options = {
      amount: amount * 100, // Convert to paise
      currency: 'INR',
      receipt: `${type}-${entityId}-${Date.now()}`,
      notes: {
        type,
        entityId,
        customerName,
        customerPhone,
      },
    };

    const order = await razorpay.orders.create(options);

    // Update entity with razorpay order ID
    if (type === 'session') {
      await SessionModel.findByIdAndUpdate(entityId, {
        razorpayOrderId: order.id,
      });
    } else if (type === 'order') {
      await FoodOrderModel.findByIdAndUpdate(entityId, {
        razorpayOrderId: order.id,
      });
    }

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, type, entityId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new AppError('Payment verification data missing', 400);
    }

    // Verify signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const secret = process.env.RAZORPAY_KEY_SECRET || '';
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(text)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      throw new AppError('Invalid payment signature', 400);
    }

    // Update entity payment status (handle both ObjectId and string IDs)
    if (type === 'reservation') {
      // Confirm reservation and create session
      const reservation = await ReservationModel.findById(entityId);
      if (!reservation) {
        throw new AppError('Reservation not found', 404);
      }

      // Confirm reservation (this creates the session)
      await confirmReservation(
        { body: { reservationId: entityId, paymentId: razorpay_payment_id } } as any,
        res,
        next
      );
      return;
    } else if (type === 'session') {
      const updateId = mongoose.Types.ObjectId.isValid(entityId)
        ? entityId
        : new mongoose.Types.ObjectId(entityId);
      
      const session = await SessionModel.findById(updateId);
      if (!session) {
        throw new AppError('Session not found', 404);
      }

      await SessionModel.findByIdAndUpdate(updateId, {
        paymentStatus: 'paid',
        paymentId: razorpay_payment_id,
      });

      res.json({ success: true, message: 'Session payment verified' });
    } else if (type === 'order') {
      const updateId = mongoose.Types.ObjectId.isValid(entityId)
        ? entityId
        : new mongoose.Types.ObjectId(entityId);
      
      const order = await FoodOrderModel.findById(updateId);
      if (!order) {
        throw new AppError('Order not found', 404);
      }

      await FoodOrderModel.findByIdAndUpdate(updateId, {
        paymentStatus: 'paid',
        paymentId: razorpay_payment_id,
      });

      res.json({ success: true, message: 'Order payment verified' });
    } else {
      throw new AppError('Invalid payment type', 400);
    }
  } catch (error) {
    next(error);
  }
};

export const markOfflinePayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { type, entityId } = req.body;

    if (!type || !entityId) {
      throw new AppError('Type and entity ID are required', 400);
    }

    if (type === 'reservation') {
      // Handle reservation offline payment
      const reservation = await ReservationModel.findById(entityId);
      if (!reservation) {
        throw new AppError('Reservation not found', 404);
      }

      if (reservation.status !== 'pending_payment') {
        throw new AppError('Reservation is not in pending payment status', 400);
      }

      // Update reservation
      reservation.status = 'payment_confirmed';
      reservation.paymentId = 'offline';
      reservation.confirmedAt = new Date();
      await reservation.save();

      // Get activity to get activityType
      const { ActivityModel } = await import('../models/Activity.js');
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
        paymentStatus: 'offline',
      });

      // Update unit status
      await ActivityUnitModel.findByIdAndUpdate(reservation.unitId, {
        status: 'occupied',
      });

      // Broadcast events
      broadcastSessionEvent('booking_confirmed', {
        reservation_id: reservation._id.toString(),
        session_id: session._id.toString(),
      });

      broadcastAvailabilityChange(reservation.activityId.toString(), 'occupied');

      res.json({
        success: true,
        message: 'Reservation confirmed and session created',
        reservationId: reservation._id.toString(),
        sessionId: session._id.toString(),
      });
      return;
    } else if (type === 'session') {
      // Handle both ObjectId and string IDs
      const session = mongoose.Types.ObjectId.isValid(entityId)
        ? await SessionModel.findById(entityId)
        : await SessionModel.findOne({ _id: new mongoose.Types.ObjectId(entityId) });
      
      if (!session) {
        throw new AppError('Session not found', 404);
      }

      const updateId = mongoose.Types.ObjectId.isValid(entityId)
        ? entityId
        : new mongoose.Types.ObjectId(entityId);

      await SessionModel.findByIdAndUpdate(updateId, {
        paymentStatus: 'offline',
      });

      res.json({ success: true, message: 'Session marked as paid offline' });
    } else if (type === 'order') {
      // Handle both ObjectId and string IDs
      const order = mongoose.Types.ObjectId.isValid(entityId)
        ? await FoodOrderModel.findById(entityId)
        : await FoodOrderModel.findOne({ _id: new mongoose.Types.ObjectId(entityId) });
      
      if (!order) {
        throw new AppError('Order not found', 404);
      }

      const updateId = mongoose.Types.ObjectId.isValid(entityId)
        ? entityId
        : new mongoose.Types.ObjectId(entityId);

      await FoodOrderModel.findByIdAndUpdate(updateId, {
        paymentStatus: 'offline',
      });

      res.json({ success: true, message: 'Order marked as paid offline' });
    } else {
      throw new AppError('Invalid payment type', 400);
    }
  } catch (error) {
    next(error);
  }
};

export const handleWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    const signature = req.headers['x-razorpay-signature'] as string;

    if (!signature) {
      throw new AppError('Webhook signature missing', 400);
    }

    const text = JSON.stringify(req.body);
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(text)
      .digest('hex');

    if (generatedSignature !== signature) {
      throw new AppError('Invalid webhook signature', 400);
    }

    const event = req.body.event;
    const payment = req.body.payload.payment.entity;

    // Handle payment success
    if (event === 'payment.captured') {
      // Find session or order by razorpay order ID and update
      // Implementation depends on your needs
    }

    res.json({ received: true });
  } catch (error) {
    next(error);
  }
};
