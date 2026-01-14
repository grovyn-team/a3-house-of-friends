import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { SessionModel } from '../models/Session.js';
import { ActivityModel, ActivityUnitModel } from '../models/Activity.js';
import { AppError } from '../middleware/errorHandler.js';
import { calculateActivityPrice, isPeakHour } from '../lib/pricing.js';
import { processWaitingQueue } from '../lib/queueManager.js';

export const createSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { activityId, unitId, customerName, customerPhone, duration, qrContext } = req.body;

    let activity;
    if (mongoose.Types.ObjectId.isValid(activityId)) {
      activity = await ActivityModel.findById(activityId);
    } else {
      activity = await ActivityModel.findOne({ type: activityId });
    }
    
    if (!activity) {
      throw new AppError('Activity not found', 404);
    }
    if (!activity.enabled) {
      throw new AppError('Activity is currently disabled', 400);
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
    
    if (!unit) {
      throw new AppError('Unit not found', 404);
    }
    if (unit.status !== 'available') {
      throw new AppError('Unit is not available', 400);
    }

    if (duration < activity.minimumDuration) {
      throw new AppError(
        `Minimum duration is ${activity.minimumDuration} minutes`,
        400
      );
    }

    const peak = isPeakHour();
    const amount = calculateActivityPrice(activity, duration, peak);

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

    const session = await SessionModel.create({
      activityId: activity._id,
      activityType: activity.type,
      unitId: unit._id,
      customerName,
      customerPhone,
      startTime,
      endTime,
      duration,
      amount,
      qrContext: qrContext || {},
    });

    await ActivityUnitModel.findByIdAndUpdate(unit._id, { status: 'occupied' });

    res.status(201).json({
      id: session._id.toString(),
      activityId: activity.type,
      activityType: session.activityType,
      unitId: session.unitId.toString(),
      customerName: session.customerName,
      customerPhone: session.customerPhone,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.duration,
      totalAmount: session.amount,
      amount: session.amount,
      paymentStatus: session.paymentStatus,
      paymentId: session.paymentId,
      razorpayOrderId: session.razorpayOrderId,
      qrContext: session.qrContext,
      status: session.status,
      extended: session.extended,
    });
  } catch (error) {
    next(error);
  }
};

export const getSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const session = await SessionModel.findById(id);

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    const activity = await ActivityModel.findById(session.activityId);
    
    res.json({
      id: session._id.toString(),
      activityId: activity?.type || session.activityType,
      activityType: session.activityType,
      unitId: session.unitId.toString(),
      customerName: session.customerName,
      customerPhone: session.customerPhone,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.duration,
      totalAmount: session.amount,
      amount: session.amount,
      paymentStatus: session.paymentStatus,
      paymentId: session.paymentId,
      razorpayOrderId: session.razorpayOrderId,
      qrContext: session.qrContext,
      status: session.status,
      extended: session.extended,
      pauseHistory: session.pauseHistory || [],
      totalPausedDuration: session.totalPausedDuration || 0,
      currentPauseStart: session.currentPauseStart,
    });
  } catch (error) {
    next(error);
  }
};

export const getActiveSessions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const sessions = await SessionModel.find({ status: { $in: ['active', 'paused', 'scheduled'] } })
      .populate('activityId')
      .populate('unitId')
      .sort({ startTime: -1 })
      .limit(limit);

    res.json(sessions.map(s => {
      const activity = s.activityId as any;
      const unit = s.unitId as any;
      
      return {
        id: s._id.toString(),
        activityId: activity?.type || activity?._id?.toString() || s.activityType,
        activityType: s.activityType,
        activityName: activity?.name,
        unitId: unit?._id?.toString() || s.unitId.toString(),
        unitName: unit?.name,
        customerName: s.customerName,
        customerPhone: s.customerPhone,
        startTime: s.startTime,
        endTime: s.endTime,
        actualStartTime: s.actualStartTime,
        duration: s.durationMinutes || s.duration,
        totalAmount: s.amount,
        amount: s.amount,
        paymentStatus: s.paymentStatus,
        paymentId: s.paymentId,
        razorpayOrderId: s.razorpayOrderId,
        qrContext: s.qrContext,
        status: s.status,
        extended: s.extended,
        pauseHistory: s.pauseHistory || [],
        totalPausedDuration: s.totalPausedDuration || 0,
        currentPauseStart: s.currentPauseStart,
        reservationId: s.reservationId?.toString(),
      };
    }));
  } catch (error) {
    next(error);
  }
};

export const getAllSessions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;
    
    const query: any = {};
    if (status) {
      query.status = status;
    } else {
      query.status = { $nin: ['scheduled', 'cancelled'] };
    }

    const sessions = await SessionModel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset);

    const activityIds = [...new Set(sessions.map(s => s.activityId.toString()))];
    const activities = await ActivityModel.find({
      _id: { $in: activityIds.map(id => new mongoose.Types.ObjectId(id)) },
    });
    const activityMap = new Map(activities.map(a => [a._id.toString(), a.type]));

    const total = await SessionModel.countDocuments(query);

    res.json({
      sessions: sessions.map(s => ({
        id: s._id.toString(),
        activityId: activityMap.get(s.activityId.toString()) || s.activityType,
        activityType: s.activityType,
        unitId: s.unitId.toString(),
        customerName: s.customerName,
        customerPhone: s.customerPhone,
        startTime: s.startTime,
        endTime: s.endTime,
        actualStartTime: s.actualStartTime,
        actualEndTime: s.actualEndTime,
        duration: s.duration,
        totalAmount: s.finalAmount || s.amount || 0,
        amount: s.amount || 0,
        finalAmount: s.finalAmount,
        paymentStatus: s.paymentStatus,
        paymentId: s.paymentId,
        razorpayOrderId: s.razorpayOrderId,
        qrContext: s.qrContext,
        status: s.status,
        extended: s.extended,
        pauseHistory: s.pauseHistory || [],
        totalPausedDuration: s.totalPausedDuration || 0,
        currentPauseStart: s.currentPauseStart,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    next(error);
  }
};

export const extendSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { additionalMinutes } = req.body;

    if (!additionalMinutes || additionalMinutes < 1) {
      throw new AppError('Additional minutes must be at least 1', 400);
    }

    const session = await SessionModel.findById(id);
    if (!session) {
      throw new AppError('Session not found', 404);
    }

    if (session.status !== 'active') {
      throw new AppError('Session is not active', 400);
    }

    const activity = await ActivityModel.findById(session.activityId);
    if (!activity) {
      throw new AppError('Activity not found', 404);
    }

    const peak = isPeakHour();
    const additionalAmount = calculateActivityPrice(activity, additionalMinutes, peak);

    const newEndTime = new Date(session.endTime.getTime() + additionalMinutes * 60 * 1000);
    const newDuration = session.duration + additionalMinutes;

    const extendedSession = await SessionModel.findByIdAndUpdate(
      id,
      {
        $set: {
          endTime: newEndTime,
          duration: newDuration,
          extended: true,
        },
      },
      { new: true }
    );

    res.json({
      session: {
        id: extendedSession!._id.toString(),
        endTime: extendedSession!.endTime,
        duration: extendedSession!.duration,
        extended: extendedSession!.extended,
      },
      additionalAmount,
    });
  } catch (error) {
    next(error);
  }
};

export const endSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const session = await SessionModel.findById(id);

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    if (session.isChallengeSession && session.challengeData && !session.challengeData.winner) {
      session.status = 'ended';
      await session.save();
      
      const { getIO } = await import('../websocket/server.js');
      const io = getIO();
      if (io) {
        io.of('/customer').to(`session:${id}`).emit('challenge_session_ended', {
          session_id: id,
          message: 'Session ended. Please select the winner.',
        });
        
        io.of('/admin').emit('challenge_session_ended', {
          session_id: id,
          message: 'Challenge session ended. Select the winner.',
        });
      }

      res.json({
        id: session._id.toString(),
        status: session.status,
        requiresWinnerSelection: true,
      });
      return;
    }

    let finalTotalPausedDuration = session.totalPausedDuration || 0;
    if (session.currentPauseStart && session.status === 'paused') {
      const pauseEnd = new Date();
      const pauseDuration = Math.round(
        (pauseEnd.getTime() - session.currentPauseStart.getTime()) / (1000 * 60)
      );
      finalTotalPausedDuration += pauseDuration;

      if (session.pauseHistory && session.pauseHistory.length > 0) {
        const lastPause = session.pauseHistory[session.pauseHistory.length - 1];
        lastPause.endTime = pauseEnd;
        lastPause.duration = pauseDuration;
      }
    }

    const actualEndTime = new Date();
    const actualStartTime = session.actualStartTime || session.startTime;
    const totalElapsedMinutes = Math.round(
      (actualEndTime.getTime() - actualStartTime.getTime()) / (1000 * 60)
    );
    const actualUsageMinutes = totalElapsedMinutes - finalTotalPausedDuration;

    let finalAmount = session.amount || 0;

    if (!session.isChallengeSession) {
      const activity = await ActivityModel.findById(session.activityId);
      
      if (activity && actualUsageMinutes < session.duration) {
        const peak = isPeakHour(actualStartTime);
        finalAmount = calculateActivityPrice(activity, actualUsageMinutes, peak);
      } else {
        finalAmount = session.amount || 0;
      }
    }

    const endedSession = await SessionModel.findByIdAndUpdate(
      id,
      {
        $set: {
          status: 'ended',
          endTime: actualEndTime,
          actualEndTime: actualEndTime,
          finalAmount: finalAmount,
          totalPausedDuration: finalTotalPausedDuration,
          currentPauseStart: undefined,
        },
      },
      { new: true }
    );

    await ActivityUnitModel.findByIdAndUpdate(session.unitId, { status: 'available' });

    const { redisUtils } = await import('../config/redis.js');
    await redisUtils.delete(`session:${id}`);

    try {
      await processWaitingQueue(session.activityId.toString());
    } catch (error) {
      console.error('Error processing waiting queue:', error);
    }

    const { getIO, notifyCustomerById } = await import('../websocket/server.js');
    const io = getIO();
    if (io) {
      const sessionData = {
        session_id: id,
        status: endedSession!.status,
        finalAmount: endedSession!.finalAmount,
        totalAmount: session.amount,
        totalPausedDuration: endedSession!.totalPausedDuration,
        actualUsageMinutes,
        actualEndTime: endedSession!.actualEndTime,
        message: 'Session ended successfully',
      };

      notifyCustomerById(id, 'session', 'session_ended', sessionData);

      io.of('/admin').emit('session_ended', sessionData);
    }

    res.json({
      id: endedSession!._id.toString(),
      status: endedSession!.status,
      finalAmount: endedSession!.finalAmount,
      totalPausedDuration: endedSession!.totalPausedDuration,
      actualUsageMinutes,
    });
  } catch (error) {
    next(error);
  }
};

export const getSessionsByPhone = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { phone } = req.params;
    const sessions = await SessionModel.find({ customerPhone: phone })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json(sessions.map(s => ({
      id: s._id.toString(),
      activityId: s.activityId.toString(),
      activityType: s.activityType,
      unitId: s.unitId.toString(),
      customerName: s.customerName,
      customerPhone: s.customerPhone,
      startTime: s.startTime,
      endTime: s.endTime,
      duration: s.duration,
      amount: s.amount,
      paymentStatus: s.paymentStatus,
      status: s.status,
    })));
  } catch (error) {
    next(error);
  }
};

export const createChallengeSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { players, activityId, activityType, duration, qrContext, customerName, customerPhone } = req.body;

    if (!players || players.length < 2) {
      throw new AppError('At least 2 players are required for a challenge', 400);
    }

    if (!activityId || !activityType) {
      throw new AppError('Activity ID and type are required', 400);
    }

    if (!duration || duration < 15 || duration > 480) {
      throw new AppError('Duration must be between 15 minutes and 8 hours', 400);
    }

    let activity;
    if (mongoose.Types.ObjectId.isValid(activityId)) {
      activity = await ActivityModel.findById(activityId);
    } else {
      activity = await ActivityModel.findOne({ type: activityId });
    }
    
    if (!activity) {
      throw new AppError('Activity not found', 404);
    }

    const availableUnit = await ActivityUnitModel.findOne({
      activityId: activity._id,
      status: 'available',
    });

    if (!availableUnit) {
      throw new AppError('No available units for this activity', 400);
    }

    const peak = isPeakHour();
    const amountPerPlayer = calculateActivityPrice(activity, duration, peak);
    const totalAmount = amountPerPlayer * players.length;

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

    const session = new SessionModel({
      activityId: activity._id,
      activityType: activityType,
      unitId: availableUnit._id,
      customerName: customerName || players[0].name,
      customerPhone: customerPhone || players[0].phone || '0000000000',
      startTime,
      endTime,
      actualStartTime: startTime,
      duration,
      baseAmount: totalAmount,
      amount: totalAmount,
      paymentStatus: 'pending',
      qrContext: qrContext || {},
      status: 'active',
      extended: false,
      isChallengeSession: true,
      challengeData: {
        sessionType: 'challenge',
        players: players.map((p: any) => ({
          name: p.name,
          phone: p.phone,
          isWinner: false,
          hasVoted: false,
        })),
        totalPlayers: players.length,
        challengeStartedBy: customerName || players[0].name,
        challengeStartedByPhone: customerPhone || players[0].phone || '0000000000',
      },
    });

    await session.save();

    await ActivityUnitModel.findByIdAndUpdate(availableUnit._id, { status: 'occupied' });

    const { getIO, notifyCustomerById } = await import('../websocket/server.js');
    const io = getIO();
    if (io) {
      io.of('/customer').to(`session:${session._id.toString()}`).emit('challenge_session_started', {
        session_id: session._id.toString(),
        players: players.map((p: any) => p.name),
        activity: activity.name,
        duration,
      });
      
      io.of('/admin').emit('challenge_session_started', {
        session_id: session._id.toString(),
        players: players.map((p: any) => p.name),
        activity: activity.name,
        duration,
      });
    }

    res.status(201).json({
      id: session._id.toString(),
      ...session.toObject(),
    });
  } catch (error) {
    next(error);
  }
};

export const voteWinner = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { winnerName, voterName } = req.body;

    const session = await SessionModel.findById(id);
    if (!session) {
      throw new AppError('Session not found', 404);
    }

    if (!session.isChallengeSession || !session.challengeData) {
      throw new AppError('This is not a challenge session', 400);
    }

    if (session.status !== 'ended' && session.status !== 'completed') {
      throw new AppError('Session must be ended before voting', 400);
    }

    const challengeData = session.challengeData;
    const playerIndex = challengeData.players.findIndex((p: any) => p.name === voterName);
    
    if (playerIndex === -1) {
      throw new AppError('Voter not found in players list', 400);
    }

    challengeData.players[playerIndex].hasVoted = true;
    challengeData.players[playerIndex].voteFor = winnerName;

    const allVoted = challengeData.players.every((p: any) => p.hasVoted);
    
    if (allVoted) {
      const voteCounts: Record<string, number> = {};
      challengeData.players.forEach((p: any) => {
        if (p.voteFor) {
          voteCounts[p.voteFor] = (voteCounts[p.voteFor] || 0) + 1;
        }
      });

      let maxVotes = 0;
      let winner = '';
      Object.entries(voteCounts).forEach(([name, votes]) => {
        if (votes > maxVotes) {
          maxVotes = votes;
          winner = name;
        }
      });

      if (winner) {
        challengeData.winner = winner;
        challengeData.winnerSelectedBy = 'players';
        challengeData.winnerSelectedAt = new Date();

        challengeData.players.forEach((p: any) => {
          p.isWinner = p.name === winner;
        });
      }
    }

    session.challengeData = challengeData;
    await session.save();

    const { getIO } = await import('../websocket/server.js');
    const io = getIO();
    if (io) {
      io.of('/customer').to(`session:${id}`).emit('winner_voted', {
        session_id: id,
        voter: voterName,
        winner: winnerName,
        allVoted,
        selectedWinner: challengeData.winner,
      });
      
      io.of('/admin').emit('winner_voted', {
        session_id: id,
        voter: voterName,
        winner: winnerName,
        allVoted,
        selectedWinner: challengeData.winner,
      });
    }

    res.json({
      id: session._id.toString(),
      challengeData: session.challengeData,
      allVoted,
      winner: challengeData.winner,
    });
  } catch (error) {
    next(error);
  }
};

export const selectWinner = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { winnerName, selectedBy = 'admin' } = req.body;

    const session = await SessionModel.findById(id);
    if (!session) {
      throw new AppError('Session not found', 404);
    }

    if (!session.isChallengeSession || !session.challengeData) {
      throw new AppError('This is not a challenge session', 400);
    }

    if (session.status !== 'ended' && session.status !== 'completed') {
      throw new AppError('Session must be ended before selecting winner', 400);
    }

    const challengeData = session.challengeData;
    const winnerExists = challengeData.players.some((p: any) => p.name === winnerName);
    
    if (!winnerExists) {
      throw new AppError('Winner not found in players list', 400);
    }

    challengeData.winner = winnerName;
    challengeData.winnerSelectedBy = selectedBy;
    challengeData.winnerSelectedAt = new Date();

    challengeData.players.forEach((p: any) => {
      p.isWinner = p.name === winnerName;
    });

    session.challengeData = challengeData;
    await session.save();

    const { getIO } = await import('../websocket/server.js');
    const io = getIO();
    if (io) {
      io.of('/customer').to(`session:${id}`).emit('winner_selected', {
        session_id: id,
        winner: winnerName,
        selectedBy,
      });
      
      io.of('/admin').emit('winner_selected', {
        session_id: id,
        winner: winnerName,
        selectedBy,
      });
    }

    res.json({
      id: session._id.toString(),
      challengeData: session.challengeData,
      winner: winnerName,
    });
  } catch (error) {
    next(error);
  }
};

export const pauseSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason, pausedBy = 'customer' } = req.body;

    const session = await SessionModel.findById(id);
    if (!session) {
      throw new AppError('Session not found', 404);
    }

    if (session.status !== 'active') {
      throw new AppError('Session must be active to pause', 400);
    }

    if (session.currentPauseStart) {
      throw new AppError('Session is already paused', 400);
    }

    const pauseStart = new Date();
    session.currentPauseStart = pauseStart;
    session.status = 'paused';
    
    if (!session.pauseHistory) {
      session.pauseHistory = [];
    }
    session.pauseHistory.push({
      startTime: pauseStart,
      reason,
      pausedBy: pausedBy === 'admin' ? 'admin' : 'customer',
    });

    const updatedSession = await session.save();

    const { getIO, notifyCustomerById } = await import('../websocket/server.js');
    notifyCustomerById(id, 'session', 'session_paused', {
      session_id: id,
      status: updatedSession.status,
      currentPauseStart: updatedSession.currentPauseStart,
      pauseHistory: updatedSession.pauseHistory,
      pausedBy: pausedBy,
      reason: reason,
      timestamp: new Date().toISOString(),
    });

    const io = getIO();
    if (io) {
      io.of('/admin').emit('session_paused', {
        session_id: id,
        status: updatedSession.status,
        currentPauseStart: updatedSession.currentPauseStart,
        pauseHistory: updatedSession.pauseHistory,
        pausedBy: pausedBy,
        reason: reason,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      id: updatedSession._id.toString(),
      status: updatedSession.status,
      currentPauseStart: updatedSession.currentPauseStart,
      pauseHistory: updatedSession.pauseHistory,
    });
  } catch (error) {
    next(error);
  }
};

export const resumeSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { resumedBy = 'customer' } = req.body;

    const session = await SessionModel.findById(id);
    if (!session) {
      throw new AppError('Session not found', 404);
    }

    if (session.status !== 'paused') {
      throw new AppError('Session is not paused', 400);
    }

    if (!session.currentPauseStart) {
      throw new AppError('No active pause found', 400);
    }

    const pauseEnd = new Date();
    const pauseDuration = Math.round(
      (pauseEnd.getTime() - session.currentPauseStart.getTime())       / (1000 * 60)
    );

    const lastPauseIndex = session.pauseHistory.length - 1;
    if (lastPauseIndex >= 0) {
      session.pauseHistory[lastPauseIndex].endTime = pauseEnd;
      session.pauseHistory[lastPauseIndex].duration = pauseDuration;
      if (!session.pauseHistory[lastPauseIndex].pausedBy) {
        session.pauseHistory[lastPauseIndex].pausedBy = resumedBy === 'admin' ? 'admin' : 'customer';
      }
    }

    session.totalPausedDuration = (session.totalPausedDuration || 0) + pauseDuration;

    const newEndTime = new Date(session.endTime.getTime() + pauseDuration * 60 * 1000);
    
    session.status = 'active';
    session.currentPauseStart = undefined;
    session.endTime = newEndTime;

    const updatedSession = await session.save();

    const { getIO, notifyCustomerById } = await import('../websocket/server.js');
    notifyCustomerById(id, 'session', 'session_resumed', {
      session_id: id,
      status: updatedSession.status,
      endTime: updatedSession.endTime,
      totalPausedDuration: updatedSession.totalPausedDuration,
      pauseHistory: updatedSession.pauseHistory,
      resumedBy: resumedBy,
      pauseDuration: pauseDuration,
      timestamp: new Date().toISOString(),
    });

    const io = getIO();
    if (io) {
      io.of('/admin').emit('session_resumed', {
        session_id: id,
        status: updatedSession.status,
        endTime: updatedSession.endTime,
        totalPausedDuration: updatedSession.totalPausedDuration,
        pauseHistory: updatedSession.pauseHistory,
        resumedBy: resumedBy,
        pauseDuration: pauseDuration,
        timestamp: new Date().toISOString(),
      });

      const remaining = Math.max(0, Math.floor((updatedSession.endTime.getTime() - Date.now()) / 1000));
      const elapsed = Math.floor((Date.now() - new Date(updatedSession.startTime).getTime()) / 1000) - (updatedSession.totalPausedDuration * 60);
      io.of('/customer').to(`session:${id}`).emit('timer_update', {
        session_id: id,
        elapsed_seconds: elapsed,
        remaining_seconds: remaining,
        new_end_time: updatedSession.endTime.toISOString(),
        timestamp: Date.now(),
      });
    }

    res.json({
      id: updatedSession._id.toString(),
      status: updatedSession.status,
      endTime: updatedSession.endTime,
      totalPausedDuration: updatedSession.totalPausedDuration,
      pauseHistory: updatedSession.pauseHistory,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const session = await SessionModel.findById(id);

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    await SessionModel.findByIdAndDelete(id);

    const { redisUtils } = await import('../config/redis.js');
    await redisUtils.delete(`session:${id}`);

    const { getIO } = await import('../websocket/server.js');
    const io = getIO();
    if (io) {
      io.of('/admin').emit('session_deleted', {
        session_id: id,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      message: 'Session deleted successfully',
      id: id,
    });
  } catch (error) {
    next(error);
  }
};
