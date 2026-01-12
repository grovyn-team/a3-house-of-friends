import mongoose, { Schema, Document } from 'mongoose';

export interface IReservation extends Document {
  activityId: mongoose.Types.ObjectId;
  unitId: mongoose.Types.ObjectId;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  amount: number;
  status: 'pending_payment' | 'payment_confirmed' | 'expired' | 'cancelled' | 'payment_failed';
  paymentIntentId?: string;
  paymentId?: string;
  customerName: string;
  customerPhone: string;
  qrContext: {
    branchId?: string;
    zoneId?: string;
    tableId?: string;
  };
  expiresAt: Date;
  confirmedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReservationSchema = new Schema<IReservation>(
  {
    activityId: {
      type: Schema.Types.ObjectId,
      ref: 'Activity',
      required: true,
    },
    unitId: {
      type: Schema.Types.ObjectId,
      ref: 'ActivityUnit',
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
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
    status: {
      type: String,
      enum: ['pending_payment', 'payment_confirmed', 'expired', 'cancelled', 'payment_failed'],
      default: 'pending_payment',
    },
    paymentIntentId: {
      type: String,
    },
    paymentId: {
      type: String,
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
    qrContext: {
      type: Schema.Types.Mixed,
      default: {},
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    confirmedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
ReservationSchema.index({ activityId: 1, startTime: 1, endTime: 1 });
ReservationSchema.index({ status: 1 });
ReservationSchema.index({ expiresAt: 1 });
ReservationSchema.index({ paymentIntentId: 1 });

export const ReservationModel = mongoose.model<IReservation>('Reservation', ReservationSchema);

