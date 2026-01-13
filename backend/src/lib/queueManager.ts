import { WaitingQueueModel } from '../models/WaitingQueue.js';
import { ReservationModel } from '../models/Reservation.js';
import { SessionModel } from '../models/Session.js';
import { ActivityUnitModel, ActivityModel } from '../models/Activity.js';
import { broadcastSessionEvent, broadcastAvailabilityChange } from '../websocket/server.js';

/**
 * Find an available unit for an activity
 */
export const findAvailableUnit = async (activityId: string): Promise<any | null> => {
  const units = await ActivityUnitModel.find({
    activityId,
    status: 'available',
  });

  if (units.length === 0) {
    return null;
  }

  // Return the first available unit
  return units[0];
};

/**
 * Add reservation to waiting queue
 */
export const addToWaitingQueue = async (
  reservationId: string,
  activityId: string,
  customerName: string,
  customerPhone: string,
  durationMinutes: number,
  amount: number,
  paymentId: string,
  paymentStatus: 'paid' | 'offline',
  qrContext?: any
): Promise<any> => {
  // Get the next position in queue
  const lastQueueEntry = await WaitingQueueModel.findOne({
    activityId,
    status: 'waiting',
  }).sort({ position: -1 });

  const nextPosition = lastQueueEntry ? lastQueueEntry.position + 1 : 1;

  const queueEntry = await WaitingQueueModel.create({
    reservationId,
    activityId,
    customerName,
    customerPhone,
    durationMinutes,
    amount,
    paymentId,
    paymentStatus,
    position: nextPosition,
    status: 'waiting',
    qrContext: qrContext || {},
  });

  // Broadcast queue update
  const { getIO } = await import('../websocket/server.js');
  const io = getIO();
  if (io) {
    io.of('/admin').emit('queue_updated', {
      action: 'added',
      queueEntry: queueEntry.toObject(),
    });

    // Notify customer
    io.to(`customer:${customerPhone}`).emit('queue_status', {
      reservationId,
      position: nextPosition,
      status: 'waiting',
      message: `You are #${nextPosition} in the waiting queue`,
    });
  }

  return queueEntry;
};

/**
 * Process waiting queue - assign next customer when a unit becomes available
 */
export const processWaitingQueue = async (activityId: string): Promise<void> => {
  // Find next customer in queue for this activity
  const nextInQueue = await WaitingQueueModel.findOne({
    activityId,
    status: 'waiting',
  }).sort({ position: 1 });

  if (!nextInQueue) {
    return; // No one waiting
  }

  // Try to find an available unit
  const availableUnit = await findAvailableUnit(activityId.toString());

  if (!availableUnit) {
    return; // No units available yet
  }

  // Mark queue entry as processing
  nextInQueue.status = 'processing';
  await nextInQueue.save();

  try {
    // Get reservation
    const reservation = await ReservationModel.findById(nextInQueue.reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    // Get activity
    const activity = await ActivityModel.findById(activityId);
    if (!activity) {
      throw new Error('Activity not found');
    }

    // Update reservation
    reservation.status = 'payment_confirmed';
    reservation.unitId = availableUnit._id;
    reservation.paymentId = nextInQueue.paymentId;
    reservation.confirmedAt = new Date();
    await reservation.save();

    // Create session
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + nextInQueue.durationMinutes * 60 * 1000);

    const session = await SessionModel.create({
      reservationId: reservation._id,
      activityId: reservation.activityId,
      activityType: activity.type,
      unitId: availableUnit._id,
      startTime,
      endTime,
      durationMinutes: nextInQueue.durationMinutes,
      duration: nextInQueue.durationMinutes,
      baseAmount: nextInQueue.amount,
      amount: nextInQueue.amount,
      status: 'active',
      actualStartTime: startTime,
      customerName: nextInQueue.customerName,
      customerPhone: nextInQueue.customerPhone,
      qrContext: nextInQueue.qrContext || {},
      paymentStatus: nextInQueue.paymentStatus,
    });

    // Update unit status
    await ActivityUnitModel.findByIdAndUpdate(availableUnit._id, {
      status: 'occupied',
    });

    // Update queue entry
    nextInQueue.status = 'assigned';
    nextInQueue.assignedAt = new Date();
    nextInQueue.sessionId = session._id;
    await nextInQueue.save();

    // Reorder remaining queue positions
    await reorderQueuePositions(activityId.toString());

    // Broadcast events
    broadcastSessionEvent('booking_confirmed', {
      reservation_id: reservation._id.toString(),
      session_id: session._id.toString(),
    });

    broadcastAvailabilityChange(activityId.toString(), 'occupied');

    // Notify customer
    const { getIO, notifyCustomerByPhone } = await import('../websocket/server.js');
    const io = getIO();
    if (io) {
      notifyCustomerByPhone(nextInQueue.customerPhone, 'queue_assigned', {
        reservationId: reservation._id.toString(),
        sessionId: session._id.toString(),
        status: 'assigned',
        message: 'A system is now available! Your session has started.',
        timestamp: new Date().toISOString(),
      });

      io.of('/admin').emit('queue_updated', {
        action: 'assigned',
        queueEntry: nextInQueue.toObject(),
        sessionId: session._id.toString(),
      });
    }
  } catch (error) {
    // If assignment fails, mark queue entry back as waiting
    nextInQueue.status = 'waiting';
    await nextInQueue.save();
    throw error;
  }
};

/**
 * Reorder queue positions after someone is assigned
 */
const reorderQueuePositions = async (activityId: string): Promise<void> => {
  const waitingEntries = await WaitingQueueModel.find({
    activityId,
    status: 'waiting',
  }).sort({ position: 1 });

  // Reassign positions sequentially
  for (let i = 0; i < waitingEntries.length; i++) {
    waitingEntries[i].position = i + 1;
    await waitingEntries[i].save();

    // Notify customer of position update
    const { getIO } = await import('../websocket/server.js');
    const io = getIO();
    if (io) {
      io.to(`customer:${waitingEntries[i].customerPhone}`).emit('queue_status', {
        reservationId: waitingEntries[i].reservationId.toString(),
        position: i + 1,
        status: 'waiting',
        message: `You are now #${i + 1} in the waiting queue`,
      });
    }
  }
};

/**
 * Get queue status for a customer
 */
export const getQueueStatus = async (reservationId: string): Promise<any | null> => {
  const queueEntry = await WaitingQueueModel.findOne({
    reservationId,
    status: 'waiting',
  }).populate('activityId', 'name type');

  if (!queueEntry) {
    return null;
  }

  // Count how many people are ahead
  const aheadCount = await WaitingQueueModel.countDocuments({
    activityId: queueEntry.activityId,
    status: 'waiting',
    position: { $lt: queueEntry.position },
  });

  return {
    position: queueEntry.position,
    aheadCount,
    status: queueEntry.status,
    estimatedWaitTime: aheadCount * 30, // Rough estimate: 30 minutes per person
  };
};
