import mongoose, { Schema, Document } from 'mongoose';

export type ActivityType = 'snooker-standard' | 'snooker-premium' | 'playstation' | 'racing' | 'smoking-room';
export type PricingType = 'per-minute' | 'per-hour' | 'fixed-duration';

export interface IActivity extends Document {
  type: ActivityType;
  name: string;
  description?: string;
  pricingType: PricingType;
  baseRate: number;
  duration?: number; // For fixed-duration activities
  minimumDuration: number;
  peakMultiplier?: number;
  bufferTime: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IActivityUnit extends Document {
  activityId: mongoose.Types.ObjectId;
  name: string;
  status: 'available' | 'occupied' | 'maintenance';
  location?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ActivitySchema = new Schema<IActivity>(
  {
    type: {
      type: String,
      required: true,
      unique: true,
      enum: ['snooker-standard', 'snooker-premium', 'playstation', 'racing', 'smoking-room'],
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    pricingType: {
      type: String,
      required: true,
      enum: ['per-minute', 'per-hour', 'fixed-duration'],
    },
    baseRate: {
      type: Number,
      required: true,
      min: 0,
    },
    duration: {
      type: Number,
      min: 1,
    },
    minimumDuration: {
      type: Number,
      required: true,
      min: 1,
      default: 30,
    },
    peakMultiplier: {
      type: Number,
      min: 1,
    },
    bufferTime: {
      type: Number,
      required: true,
      min: 0,
      default: 5,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const ActivityUnitSchema = new Schema<IActivityUnit>(
  {
    activityId: {
      type: Schema.Types.ObjectId,
      ref: 'Activity',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['available', 'occupied', 'maintenance'],
      default: 'available',
    },
    location: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
ActivitySchema.index({ type: 1 });
ActivitySchema.index({ enabled: 1 });
ActivityUnitSchema.index({ activityId: 1 });
ActivityUnitSchema.index({ status: 1 });
ActivityUnitSchema.index({ activityId: 1, name: 1 }, { unique: true });

export const ActivityModel = mongoose.model<IActivity>('Activity', ActivitySchema);
export const ActivityUnitModel = mongoose.model<IActivityUnit>('ActivityUnit', ActivityUnitSchema);
