import mongoose, { Schema, Document } from 'mongoose';

export interface IWaitingQueue extends Document {
  reservationId: mongoose.Types.ObjectId;
  activityId: mongoose.Types.ObjectId;
  customerName: string;
  customerPhone: string;
  durationMinutes: number;
  amount: number;
  paymentId: string; // Razorpay payment ID for online payments
  paymentStatus: 'paid' | 'offline';
  position: number; // Position in queue (1, 2, 3, etc.)
  status: 'waiting' | 'processing' | 'assigned' | 'cancelled' | 'expired';
  qrContext?: {
    branchId?: string;
    zoneId?: string;
    tableId?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  assignedAt?: Date;
  sessionId?: mongoose.Types.ObjectId; // Session created when assigned
}

const WaitingQueueSchema = new Schema<IWaitingQueue>(
  {
    reservationId: {
      type: Schema.Types.ObjectId,
      ref: 'Reservation',
      required: true,
    },
    activityId: {
      type: Schema.Types.ObjectId,
      ref: 'Activity',
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
    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentId: {
      type: String,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['paid', 'offline'],
      required: true,
    },
    position: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ['waiting', 'processing', 'assigned', 'cancelled', 'expired'],
      default: 'waiting',
    },
    qrContext: {
      type: Schema.Types.Mixed,
      default: {},
    },
    assignedAt: {
      type: Date,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'Session',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
WaitingQueueSchema.index({ activityId: 1, status: 1, position: 1 });
WaitingQueueSchema.index({ reservationId: 1 });
WaitingQueueSchema.index({ customerPhone: 1 });
WaitingQueueSchema.index({ status: 1, position: 1 }); // For efficient queue processing

export const WaitingQueueModel = mongoose.model<IWaitingQueue>('WaitingQueue', WaitingQueueSchema);
