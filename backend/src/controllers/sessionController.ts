import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { SessionModel } from '../models/Session.js';
import { ActivityModel, ActivityUnitModel } from '../models/Activity.js';
import { AppError } from '../middleware/errorHandler.js';
import { calculateActivityPrice, isPeakHour } from '../lib/pricing.js';

export const createSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { activityId, unitId, customerName, customerPhone, duration, qrContext } = req.body;

    // Verify activity exists and is enabled
    // Handle both ObjectId and type string (e.g., "snooker-standard")
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

    // Verify unit exists and is available
    // Handle both ObjectId and name-based lookup
    let unit;
    if (mongoose.Types.ObjectId.isValid(unitId)) {
      unit = await ActivityUnitModel.findById(unitId);
    } else {
      // If unitId is a name, find by name and activityId
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

    // Check for minimum duration
    if (duration < activity.minimumDuration) {
      throw new AppError(
        `Minimum duration is ${activity.minimumDuration} minutes`,
        400
      );
    }

    // Calculate price
    const peak = isPeakHour();
    const amount = calculateActivityPrice(activity, duration, peak);

    // Create session
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

    const session = await SessionModel.create({
      activityId: activity._id, // Use MongoDB _id
      activityType: activity.type,
      unitId: unit._id, // Use MongoDB _id
      customerName,
      customerPhone,
      startTime,
      endTime,
      duration,
      amount,
      qrContext: qrContext || {},
    });

    // Mark unit as occupied
    await ActivityUnitModel.findByIdAndUpdate(unit._id, { status: 'occupied' });

    res.status(201).json({
      id: session._id.toString(),
      activityId: activity.type, // Return type string for frontend compatibility
      activityType: session.activityType,
      unitId: session.unitId.toString(),
      customerName: session.customerName,
      customerPhone: session.customerPhone,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.duration,
      totalAmount: session.amount, // Use totalAmount for consistency
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
      activityId: activity?.type || session.activityType, // Return type string for frontend
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
    // Include both active and paused sessions
    const sessions = await SessionModel.find({ status: { $in: ['active', 'paused'] } })
      .sort({ startTime: -1 })
      .limit(limit);

    // Get activities for all sessions to map activityId to type
    const activityIds = [...new Set(sessions.map(s => s.activityId.toString()))];
    const activities = await ActivityModel.find({
      _id: { $in: activityIds.map(id => new mongoose.Types.ObjectId(id)) },
    });
    const activityMap = new Map(activities.map(a => [a._id.toString(), a.type]));

    res.json(sessions.map(s => ({
      id: s._id.toString(),
      activityId: activityMap.get(s.activityId.toString()) || s.activityType, // Return type string
      activityType: s.activityType,
      unitId: s.unitId.toString(),
      customerName: s.customerName,
      customerPhone: s.customerPhone,
      startTime: s.startTime,
      endTime: s.endTime,
      duration: s.duration,
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
    })));
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
    const status = req.query.status as string; // Optional status filter
    
    // Build query
    const query: any = {};
    if (status) {
      query.status = status;
    } else {
      // Exclude scheduled and cancelled by default for history
      query.status = { $nin: ['scheduled', 'cancelled'] };
    }

    const sessions = await SessionModel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset);

    // Get activities for all sessions to map activityId to type
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

    // Calculate additional cost
    const activity = await ActivityModel.findById(session.activityId);
    if (!activity) {
      throw new AppError('Activity not found', 404);
    }

    const peak = isPeakHour();
    const additionalAmount = calculateActivityPrice(activity, additionalMinutes, peak);

    // Extend session
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

    // For challenge sessions, don't end immediately - wait for winner selection
    if (session.isChallengeSession && session.challengeData && !session.challengeData.winner) {
      // Just mark as ended but keep session active for winner selection
      session.status = 'ended';
      await session.save();
      
      // Emit event to prompt winner selection
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

    // Close any active pause before ending
    let finalTotalPausedDuration = session.totalPausedDuration || 0;
    if (session.currentPauseStart && session.status === 'paused') {
      const pauseEnd = new Date();
      const pauseDuration = Math.round(
        (pauseEnd.getTime() - session.currentPauseStart.getTime()) / (1000 * 60)
      );
      finalTotalPausedDuration += pauseDuration;

      // Update last pause entry
      if (session.pauseHistory && session.pauseHistory.length > 0) {
        const lastPause = session.pauseHistory[session.pauseHistory.length - 1];
        lastPause.endTime = pauseEnd;
        lastPause.duration = pauseDuration;
      }
    }

    // Calculate actual usage time (excluding paused time)
    const actualEndTime = new Date();
    const actualStartTime = session.actualStartTime || session.startTime;
    const totalElapsedMinutes = Math.round(
      (actualEndTime.getTime() - actualStartTime.getTime()) / (1000 * 60)
    );
    const actualUsageMinutes = totalElapsedMinutes - finalTotalPausedDuration;

    // Recalculate final amount based on actual usage time
    // For challenge sessions, keep the total amount (all players included)
    let finalAmount = session.amount || 0;

    if (!session.isChallengeSession) {
      // Only recalculate for non-challenge sessions
      const activity = await ActivityModel.findById(session.activityId);
      
      if (activity && actualUsageMinutes < session.duration) {
        // If actual usage is less than booked duration, recalculate
        const peak = isPeakHour();
        finalAmount = calculateActivityPrice(activity, actualUsageMinutes, peak);
      } else {
        // Use original amount if usage is equal or more
        finalAmount = session.amount || 0;
      }
    }
    // For challenge sessions, finalAmount is already set to total (all players)

    // End session
    const endedSession = await SessionModel.findByIdAndUpdate(
      id,
      {
        $set: {
          status: 'ended',
          actualEndTime: actualEndTime,
          finalAmount: finalAmount,
          totalPausedDuration: finalTotalPausedDuration,
          currentPauseStart: undefined,
        },
      },
      { new: true }
    );

    // Mark unit as available
    await ActivityUnitModel.findByIdAndUpdate(session.unitId, { status: 'available' });

    // Emit WebSocket events to both customer and admin
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

      // Notify customer
      notifyCustomerById(id, 'session', 'session_ended', sessionData);

      // Notify admin
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

    // Verify activity exists
    let activity;
    if (mongoose.Types.ObjectId.isValid(activityId)) {
      activity = await ActivityModel.findById(activityId);
    } else {
      activity = await ActivityModel.findOne({ type: activityId });
    }
    
    if (!activity) {
      throw new AppError('Activity not found', 404);
    }

    // Find an available unit
    const availableUnit = await ActivityUnitModel.findOne({
      activityId: activity._id,
      status: 'available',
    });

    if (!availableUnit) {
      throw new AppError('No available units for this activity', 400);
    }

    // Calculate total amount (for all players)
    const peak = isPeakHour();
    const amountPerPlayer = calculateActivityPrice(activity, duration, peak);
    const totalAmount = amountPerPlayer * players.length;

    // Create start and end times
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

    // Create challenge session
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

    // Mark unit as occupied
    await ActivityUnitModel.findByIdAndUpdate(availableUnit._id, { status: 'occupied' });

    // Emit WebSocket event
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

    // Update voter's vote
    const challengeData = session.challengeData;
    const playerIndex = challengeData.players.findIndex((p: any) => p.name === voterName);
    
    if (playerIndex === -1) {
      throw new AppError('Voter not found in players list', 400);
    }

    challengeData.players[playerIndex].hasVoted = true;
    challengeData.players[playerIndex].voteFor = winnerName;

    // Check if all players have voted
    const allVoted = challengeData.players.every((p: any) => p.hasVoted);
    
    if (allVoted) {
      // Count votes
      const voteCounts: Record<string, number> = {};
      challengeData.players.forEach((p: any) => {
        if (p.voteFor) {
          voteCounts[p.voteFor] = (voteCounts[p.voteFor] || 0) + 1;
        }
      });

      // Find winner (player with most votes)
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

        // Mark winner in players array
        challengeData.players.forEach((p: any) => {
          p.isWinner = p.name === winner;
        });
      }
    }

    session.challengeData = challengeData;
    await session.save();

    // Emit WebSocket event
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

    // Verify winner is in players list
    const challengeData = session.challengeData;
    const winnerExists = challengeData.players.some((p: any) => p.name === winnerName);
    
    if (!winnerExists) {
      throw new AppError('Winner not found in players list', 400);
    }

    // Set winner
    challengeData.winner = winnerName;
    challengeData.winnerSelectedBy = selectedBy;
    challengeData.winnerSelectedAt = new Date();

    // Update players array
    challengeData.players.forEach((p: any) => {
      p.isWinner = p.name === winnerName;
    });

    session.challengeData = challengeData;
    await session.save();

    // Emit WebSocket event
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

    // Start pause
    const pauseStart = new Date();
    session.currentPauseStart = pauseStart;
    session.status = 'paused';
    
    // Add to pause history
    if (!session.pauseHistory) {
      session.pauseHistory = [];
    }
    session.pauseHistory.push({
      startTime: pauseStart,
      reason,
      pausedBy: pausedBy === 'admin' ? 'admin' : 'customer',
    });

    const updatedSession = await session.save();

    // Emit WebSocket event for real-time updates
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

    // Also notify admin namespace
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

    // Calculate pause duration
    const pauseEnd = new Date();
    const pauseDuration = Math.round(
      (pauseEnd.getTime() - session.currentPauseStart.getTime()) / (1000 * 60)
    );

    // Update pause history entry
    const lastPauseIndex = session.pauseHistory.length - 1;
    if (lastPauseIndex >= 0) {
      session.pauseHistory[lastPauseIndex].endTime = pauseEnd;
      session.pauseHistory[lastPauseIndex].duration = pauseDuration;
      if (!session.pauseHistory[lastPauseIndex].pausedBy) {
        session.pauseHistory[lastPauseIndex].pausedBy = resumedBy === 'admin' ? 'admin' : 'customer';
      }
    }

    // Update total paused duration
    session.totalPausedDuration = (session.totalPausedDuration || 0) + pauseDuration;

    // Extend end time by paused duration to account for the break
    const newEndTime = new Date(session.endTime.getTime() + pauseDuration * 60 * 1000);
    
    // Resume session
    session.status = 'active';
    session.currentPauseStart = undefined;
    session.endTime = newEndTime;

    const updatedSession = await session.save();

    // Emit WebSocket event for real-time updates
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

    // Also notify admin namespace
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

      // Broadcast timer update with new end time
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
