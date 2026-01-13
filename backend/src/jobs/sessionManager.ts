import cron from 'node-cron';
import { SessionModel } from '../models/Session.js';
import { ReservationModel } from '../models/Reservation.js';
import { ActivityUnitModel } from '../models/Activity.js';
import { redisUtils } from '../config/redis.js';
import { broadcastTimerUpdate, broadcastSessionEvent } from '../websocket/server.js';
import { processWaitingQueue } from '../lib/queueManager.js';

cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000);

    const sessionsToStart = await SessionModel.find({
      status: 'scheduled',
      startTime: { $lte: now, $gte: fiveMinutesAgo },
    });

    for (const session of sessionsToStart) {
      session.status = 'active';
      session.actualStartTime = now;
      await session.save();

      await redisUtils.setSessionState(session._id.toString(), {
        status: 'active',
        started_at: now.getTime().toString(),
        elapsed_seconds: '0',
      });

      broadcastSessionEvent('session_started', {
        session_id: session._id.toString(),
        activity_id: session.activityId.toString(),
        start_time: now.toISOString(),
      });

      console.log('✅ Auto-started session:', session._id);
    }
  } catch (error) {
    console.error('Error auto-starting sessions:', error);
  }
});

cron.schedule('*/30 * * * * *', async () => {
  try {
    const now = new Date();
    const sessionsToEnd = await SessionModel.find({
      status: 'active',
      endTime: { $lte: now },
    });

    for (const session of sessionsToEnd) {
      session.status = 'completed';
      session.actualEndTime = now;
      await session.save();

      await redisUtils.delete(`session:${session._id}`);

      await ActivityUnitModel.findByIdAndUpdate(session.unitId, {
        status: 'available',
      });

      // Process waiting queue for this activity
      try {
        await processWaitingQueue(session.activityId.toString());
      } catch (error) {
        console.error('Error processing waiting queue:', error);
      }

      broadcastSessionEvent('session_ended', {
        session_id: session._id.toString(),
        final_amount: session.finalAmount || session.baseAmount,
        actual_duration: session.durationMinutes,
      });

      console.log('✅ Auto-ended session:', session._id);
    }
  } catch (error) {
    console.error('Error auto-ending sessions:', error);
  }
});

cron.schedule('*/10 * * * * *', async () => {
  try {
    // Include both active and paused sessions
    const activeSessions = await SessionModel.find({
      status: { $in: ['active', 'paused'] },
      actualStartTime: { $exists: true },
    });

    for (const session of activeSessions) {
      const startTime = new Date(session.actualStartTime!).getTime();
      const now = Date.now();
      const endTime = new Date(session.endTime).getTime();
      const isPaused = session.status === 'paused';

      let elapsed: number;
      let remaining: number;

      if (isPaused && session.currentPauseStart) {
        const pauseStart = new Date(session.currentPauseStart).getTime();
        elapsed = Math.floor((pauseStart - startTime) / 1000);
        remaining = Math.max(0, Math.floor((endTime - pauseStart) / 1000));
      } else {
        const totalPausedSeconds = (session.totalPausedDuration || 0) * 60;
        const totalElapsed = Math.floor((now - startTime) / 1000);
        elapsed = Math.max(0, totalElapsed - totalPausedSeconds);
        remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      }

      await redisUtils.setSessionState(session._id.toString(), {
        status: session.status,
        started_at: startTime.toString(),
        elapsed_seconds: elapsed.toString(),
        is_paused: isPaused.toString(),
      });

      broadcastTimerUpdate(session._id.toString(), elapsed, remaining);
    }
  } catch (error) {
    console.error('Error broadcasting timers:', error);
  }
});

cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    const expired = await ReservationModel.updateMany(
      {
        status: 'pending_payment',
        expiresAt: { $lte: now },
      },
      {
        status: 'expired',
      }
    );

    if (expired.modifiedCount > 0) {
      console.log(`✅ Expired ${expired.modifiedCount} reservations`);
      
      const expiredReservations = await ReservationModel.find({
        status: 'expired',
        expiresAt: { $lte: now },
      });

      for (const reservation of expiredReservations) {
        const { broadcastAvailabilityChange } = await import('../websocket/server.js');
        broadcastAvailabilityChange(reservation.activityId.toString(), 'available');
      }
    }
  } catch (error) {
    console.error('Error expiring reservations:', error);
  }
});

cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60000);

    const sessions = await SessionModel.find({
      status: 'active',
      endTime: { $gte: now, $lte: fiveMinutesFromNow },
    });

    for (const session of sessions) {
      broadcastSessionEvent('session_ending_soon', {
        session_id: session._id.toString(),
        remaining_seconds: Math.floor((new Date(session.endTime).getTime() - now.getTime()) / 1000),
      });
    }
  } catch (error) {
    console.error('Error sending warnings:', error);
  }
});

console.log('✅ Cron jobs initialized');

