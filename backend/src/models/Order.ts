import mongoose, { Schema, Document } from 'mongoose';

export type MenuCategory = 'chinese' | 'sandwiches' | 'pasta' | 'beverages';

export interface IMenuItem extends Document {
  name: string;
  category: MenuCategory;
  description?: string;
  price: number;
  available: boolean;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  menuItemId: mongoose.Types.ObjectId;
  quantity: number;
  price: number;
  notes?: string;
}

export interface QRContext {
  branchId?: string;
  zoneId?: string;
  tableId?: string;
}

export interface IFoodOrder extends Document {
  items: OrderItem[];
  totalAmount: number;
  customerName: string;
  customerPhone: string;
  qrContext: QRContext;
  sessionId?: mongoose.Types.ObjectId;
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'offline';
  paymentId?: string;
  razorpayOrderId?: string;
  estimatedReadyTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MenuItemSchema = new Schema<IMenuItem>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['chinese', 'sandwiches', 'pasta', 'beverages'],
    },
    description: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    available: {
      type: Boolean,
      default: true,
    },
    imageUrl: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const OrderItemSchema = new Schema({
  menuItemId: {
    type: Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  notes: {
    type: String,
    trim: true,
  },
}, { _id: false });

const FoodOrderSchema = new Schema<IFoodOrder>(
  {
    items: {
      type: [OrderItemSchema],
      required: true,
      validate: {
        validator: (items: OrderItem[]) => items.length > 0,
        message: 'Order must have at least one item',
      },
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
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
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'Session',
    },
    status: {
      type: String,
      enum: ['pending', 'preparing', 'ready', 'served', 'cancelled'],
      default: 'pending',
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
    estimatedReadyTime: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
MenuItemSchema.index({ category: 1 });
MenuItemSchema.index({ available: 1 });
FoodOrderSchema.index({ status: 1 });
FoodOrderSchema.index({ paymentStatus: 1 });
FoodOrderSchema.index({ customerPhone: 1 });
FoodOrderSchema.index({ sessionId: 1 });
FoodOrderSchema.index({ createdAt: -1 });

export const MenuItemModel = mongoose.model<IMenuItem>('MenuItem', MenuItemSchema);
export const FoodOrderModel = mongoose.model<IFoodOrder>('FoodOrder', FoodOrderSchema);
