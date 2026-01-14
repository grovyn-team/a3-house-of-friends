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

  const { getIO } = await import('../websocket/server.js');
  const io = getIO();
  if (io) {
    io.of('/admin').emit('queue_updated', {
      action: 'added',
      queueEntry: queueEntry.toObject(),
    });

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
  const nextInQueue = await WaitingQueueModel.findOne({
    activityId,
    status: 'waiting',
  }).sort({ position: 1 });

  if (!nextInQueue) {
    return;
  }

  const availableUnit = await findAvailableUnit(activityId.toString());

  if (!availableUnit) {
    return;
  }

  const { getIO, notifyCustomerByPhone } = await import('../websocket/server.js');
  const io = getIO();

  if (io) {
    notifyCustomerByPhone(nextInQueue.customerPhone, 'queue_resource_available', {
      reservationId: nextInQueue.reservationId.toString(),
      activityId: activityId.toString(),
      activityName: (await ActivityModel.findById(activityId))?.name || 'Activity',
      unitId: availableUnit._id.toString(),
      unitName: availableUnit.name,
      amount: nextInQueue.amount,
      duration: nextInQueue.durationMinutes,
      message: 'A system is now available! Please proceed to payment or exit the queue.',
      timestamp: new Date().toISOString(),
    });
  }

  return;
};

export const reorderQueuePositions = async (activityId: string): Promise<void> => {
  const waitingEntries = await WaitingQueueModel.find({
    activityId,
    status: 'waiting',
  }).sort({ position: 1 });

  for (let i = 0; i < waitingEntries.length; i++) {
    waitingEntries[i].position = i + 1;
    await waitingEntries[i].save();

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

  const aheadCount = await WaitingQueueModel.countDocuments({
    activityId: queueEntry.activityId,
    status: 'waiting',
    position: { $lt: queueEntry.position },
  });

  return {
    position: queueEntry.position,
    aheadCount,
    status: queueEntry.status,
    estimatedWaitTime: aheadCount * 30,
  };
};
