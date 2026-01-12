import mongoose, { Schema, Document } from 'mongoose';

// Inventory Category Model
export type InventoryCategoryType = 
  | 'gaming-equipment' 
  | 'furniture' 
  | 'consumables' 
  | 'electronics' 
  | 'food-beverages' 
  | 'maintenance-supplies'
  | 'other';

export interface IInventoryCategory extends Document {
  name: string;
  type: InventoryCategoryType;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Inventory Item Model
export type InventoryItemType = 'equipment' | 'consumable' | 'furniture' | 'electronics' | 'other';
export type InventoryItemStatus = 'active' | 'inactive' | 'maintenance' | 'retired';
export type StockTrackingType = 'none' | 'quantity' | 'serialized';

export interface IInventoryItem extends Document {
  name: string;
  sku: string;
  categoryId: mongoose.Types.ObjectId;
  type: InventoryItemType;
  description?: string;
  brand?: string;
  itemModel?: string;
  status: InventoryItemStatus;
  stockTracking: StockTrackingType;
  currentStock?: number;
  minStockLevel?: number;
  maxStockLevel?: number;
  unit?: string;
  costPrice?: number;
  sellingPrice?: number;
  location?: string;
  purchaseDate?: Date;
  warrantyExpiry?: Date;
  serialNumber?: string; // For serialized items
  barcode?: string;
  imageUrl?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEquipmentAssignment extends Document {
  inventoryItemId: mongoose.Types.ObjectId;
  serviceInstanceId: mongoose.Types.ObjectId; // ActivityUnit _id
  assignedAt: Date;
  assignedBy?: mongoose.Types.ObjectId; // User who assigned
  unassignedAt?: Date;
  unassignedBy?: mongoose.Types.ObjectId;
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Maintenance Log Model
export type MaintenanceType = 'routine' | 'repair' | 'inspection' | 'upgrade' | 'cleaning';
export type MaintenanceStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled';

export interface IMaintenanceLog extends Document {
  inventoryItemId?: mongoose.Types.ObjectId; // Optional - can be for service instance too
  serviceInstanceId?: mongoose.Types.ObjectId; // For service instance maintenance
  type: MaintenanceType;
  status: MaintenanceStatus;
  title: string;
  description?: string;
  scheduledDate?: Date;
  completedDate?: Date;
  performedBy?: mongoose.Types.ObjectId; // User who performed maintenance
  cost?: number;
  partsReplaced?: string[];
  notes?: string;
  nextMaintenanceDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Stock Transaction Model - Track all stock movements
export type TransactionType = 'purchase' | 'sale' | 'adjustment' | 'transfer' | 'waste' | 'return';
export type TransactionReason = 
  | 'new-purchase' 
  | 'restock' 
  | 'customer-order' 
  | 'damaged' 
  | 'expired' 
  | 'theft' 
  | 'correction' 
  | 'transfer-in' 
  | 'transfer-out'
  | 'other';

export interface IStockTransaction extends Document {
  inventoryItemId: mongoose.Types.ObjectId;
  type: TransactionType;
  reason: TransactionReason;
  quantity: number; // Positive for additions, negative for deductions
  unitPrice?: number; // Price per unit at time of transaction
  totalAmount?: number; // Total transaction value
  referenceNumber?: string; // Invoice, order number, etc.
  performedBy?: mongoose.Types.ObjectId; // User who performed transaction
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryCategorySchema = new Schema<IInventoryCategory>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['gaming-equipment', 'furniture', 'consumables', 'electronics', 'food-beverages', 'maintenance-supplies', 'other'],
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const InventoryItemSchema = new Schema<IInventoryItem>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'InventoryCategory',
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['equipment', 'consumable', 'furniture', 'electronics', 'other'],
    },
    description: {
      type: String,
      trim: true,
    },
    brand: {
      type: String,
      trim: true,
    },
    itemModel: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'maintenance', 'retired'],
      default: 'active',
    },
    stockTracking: {
      type: String,
      enum: ['none', 'quantity', 'serialized'],
      default: 'none',
    },
    currentStock: {
      type: Number,
      min: 0,
    },
    minStockLevel: {
      type: Number,
      min: 0,
    },
    maxStockLevel: {
      type: Number,
      min: 0,
    },
    unit: {
      type: String,
      trim: true,
      default: 'pieces',
    },
    costPrice: {
      type: Number,
      min: 0,
    },
    sellingPrice: {
      type: Number,
      min: 0,
    },
    location: {
      type: String,
      trim: true,
    },
    purchaseDate: {
      type: Date,
    },
    warrantyExpiry: {
      type: Date,
    },
    serialNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
    barcode: {
      type: String,
      trim: true,
    },
    imageUrl: {
      type: String,
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

const EquipmentAssignmentSchema = new Schema<IEquipmentAssignment>(
  {
    inventoryItemId: {
      type: Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true,
    },
    serviceInstanceId: {
      type: Schema.Types.ObjectId,
      ref: 'ActivityUnit',
      required: true,
    },
    assignedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    unassignedAt: {
      type: Date,
    },
    unassignedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    isActive: {
      type: Boolean,
      default: true,
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

const MaintenanceLogSchema = new Schema<IMaintenanceLog>(
  {
    inventoryItemId: {
      type: Schema.Types.ObjectId,
      ref: 'InventoryItem',
    },
    serviceInstanceId: {
      type: Schema.Types.ObjectId,
      ref: 'ActivityUnit',
    },
    type: {
      type: String,
      required: true,
      enum: ['routine', 'repair', 'inspection', 'upgrade', 'cleaning'],
    },
    status: {
      type: String,
      enum: ['scheduled', 'in-progress', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    scheduledDate: {
      type: Date,
    },
    completedDate: {
      type: Date,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    cost: {
      type: Number,
      min: 0,
    },
    partsReplaced: [{
      type: String,
      trim: true,
    }],
    notes: {
      type: String,
      trim: true,
    },
    nextMaintenanceDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const StockTransactionSchema = new Schema<IStockTransaction>(
  {
    inventoryItemId: {
      type: Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['purchase', 'sale', 'adjustment', 'transfer', 'waste', 'return'],
    },
    reason: {
      type: String,
      required: true,
      enum: ['new-purchase', 'restock', 'customer-order', 'damaged', 'expired', 'theft', 'correction', 'transfer-in', 'transfer-out', 'other'],
    },
    quantity: {
      type: Number,
      required: true,
    },
    unitPrice: {
      type: Number,
      min: 0,
    },
    totalAmount: {
      type: Number,
      min: 0,
    },
    referenceNumber: {
      type: String,
      trim: true,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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
InventoryCategorySchema.index({ type: 1 });
InventoryItemSchema.index({ sku: 1 });
InventoryItemSchema.index({ categoryId: 1 });
InventoryItemSchema.index({ type: 1 });
InventoryItemSchema.index({ status: 1 });
InventoryItemSchema.index({ location: 1 });
InventoryItemSchema.index({ currentStock: 1 }); // For low stock alerts
EquipmentAssignmentSchema.index({ inventoryItemId: 1 });
EquipmentAssignmentSchema.index({ serviceInstanceId: 1 });
EquipmentAssignmentSchema.index({ isActive: 1 });
MaintenanceLogSchema.index({ inventoryItemId: 1 });
MaintenanceLogSchema.index({ serviceInstanceId: 1 });
MaintenanceLogSchema.index({ status: 1 });
MaintenanceLogSchema.index({ scheduledDate: 1 });
StockTransactionSchema.index({ inventoryItemId: 1 });
StockTransactionSchema.index({ type: 1 });
StockTransactionSchema.index({ createdAt: -1 });

export const InventoryCategoryModel = mongoose.model<IInventoryCategory>(
  'InventoryCategory',
  InventoryCategorySchema
);

export const InventoryItemModel = mongoose.model<IInventoryItem>(
  'InventoryItem',
  InventoryItemSchema
);

export const EquipmentAssignmentModel = mongoose.model<IEquipmentAssignment>(
  'EquipmentAssignment',
  EquipmentAssignmentSchema
);

export const MaintenanceLogModel = mongoose.model<IMaintenanceLog>(
  'MaintenanceLog',
  MaintenanceLogSchema
);

export const StockTransactionModel = mongoose.model<IStockTransaction>(
  'StockTransaction',
  StockTransactionSchema
);
