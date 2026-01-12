import mongoose, { Schema, Document } from 'mongoose';
import { ActivityType } from './Activity.js';

export interface QRContext {
  branchId?: string;
  zoneId?: string;
  tableId?: string;
}

export interface PauseEntry {
  startTime: Date;
  endTime?: Date;
  duration?: number; // in minutes
  reason?: string;
  pausedBy?: 'customer' | 'admin';
}

export interface ChallengePlayer {
  name: string;
  phone?: string;
  isWinner?: boolean;
  hasVoted?: boolean;
  voteFor?: string; // player name they voted for
}

export interface ChallengeSession {
  sessionType: 'challenge';
  players: ChallengePlayer[];
  winner?: string; // player name who won
  winnerSelectedBy: 'players' | 'admin';
  winnerSelectedAt?: Date;
  totalPlayers: number;
  challengeStartedBy: string; // player name who started
  challengeStartedByPhone: string;
}

export interface ISession extends Document {
  reservationId?: mongoose.Types.ObjectId;
  activityId: mongoose.Types.ObjectId;
  activityType: ActivityType;
  unitId: mongoose.Types.ObjectId;
  customerName: string;
  customerPhone: string;
  startTime: Date;
  endTime: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  duration: number; // in minutes
  durationMinutes?: number; // alias for duration
  baseAmount: number;
  amount?: number; // alias for baseAmount
  finalAmount?: number;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'offline';
  paymentId?: string;
  razorpayOrderId?: string;
  qrContext: QRContext;
  status: 'scheduled' | 'active' | 'completed' | 'ended' | 'paused' | 'cancelled';
  extended: boolean;
  // Pause tracking
  pauseHistory: PauseEntry[];
  totalPausedDuration: number; // in minutes
  currentPauseStart?: Date;
  // Challenge/Friends session
  isChallengeSession?: boolean;
  challengeData?: ChallengeSession;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    activityId: {
      type: Schema.Types.ObjectId,
      ref: 'Activity',
      required: true,
    },
    reservationId: {
      type: Schema.Types.ObjectId,
      ref: 'Reservation',
    },
    activityType: {
      type: String,
      required: true,
    },
    unitId: {
      type: Schema.Types.ObjectId,
      ref: 'ActivityUnit',
      required: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerPhone: {
      type: String,
      required: true,
      trim: true,
    },
    startTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endTime: {
      type: Date,
      required: true,
    },
    actualStartTime: {
      type: Date,
    },
    actualEndTime: {
      type: Date,
    },
    duration: {
      type: Number,
      required: true,
      min: 1,
    },
    durationMinutes: {
      type: Number,
      min: 1,
    },
    baseAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    amount: {
      type: Number,
      min: 0,
    },
    finalAmount: {
      type: Number,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'offline'],
      default: 'pending',
    },
    paymentId: {
      type: String,
    },
    razorpayOrderId: {
      type: String,
    },
    qrContext: {
      type: Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['scheduled', 'active', 'completed', 'ended', 'paused', 'cancelled'],
      default: 'scheduled',
    },
    extended: {
      type: Boolean,
      default: false,
    },
    // Pause tracking
    pauseHistory: [{
      startTime: {
        type: Date,
        required: true,
      },
      endTime: Date,
      duration: Number, // in minutes
      reason: String,
      pausedBy: {
        type: String,
        enum: ['customer', 'admin'],
      },
    }],
    totalPausedDuration: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentPauseStart: Date,
    // Challenge/Friends session
    isChallengeSession: {
      type: Boolean,
      default: false,
    },
    challengeData: {
      sessionType: {
        type: String,
        default: 'challenge',
      },
      players: [{
        name: {
          type: String,
          required: true,
          trim: true,
        },
        phone: String,
        isWinner: Boolean,
        hasVoted: Boolean,
        voteFor: String,
      }],
      winner: String,
      winnerSelectedBy: {
        type: String,
        enum: ['players', 'admin'],
      },
      winnerSelectedAt: Date,
      totalPlayers: Number,
      challengeStartedBy: String,
      challengeStartedByPhone: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
SessionSchema.index({ activityId: 1 });
SessionSchema.index({ unitId: 1 });
SessionSchema.index({ status: 1 });
SessionSchema.index({ customerPhone: 1 });
SessionSchema.index({ paymentStatus: 1 });
SessionSchema.index({ startTime: 1 });
SessionSchema.index({ createdAt: -1 });

export const SessionModel = mongoose.model<ISession>('Session', SessionSchema);
