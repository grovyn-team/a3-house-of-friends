import mongoose, { Schema, Document } from 'mongoose';

export type UserRole = 'admin' | 'staff' | 'chef';

export interface IUser extends Document {
  username: string;
  email?: string;
  password: string;
  role: UserRole;
  name: string;
  branchId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['admin', 'staff', 'chef'],
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    branchId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
UserSchema.index({ username: 1 });
UserSchema.index({ email: 1 });

export const UserModel = mongoose.model<IUser>('User', UserSchema);
