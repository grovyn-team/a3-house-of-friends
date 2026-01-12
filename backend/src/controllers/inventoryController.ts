import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import mongoose from 'mongoose';
import {
  InventoryCategoryModel,
  InventoryItemModel,
  EquipmentAssignmentModel,
  MaintenanceLogModel,
  StockTransactionModel,
} from '../models/Inventory.js';
import { ActivityUnitModel } from '../models/Activity.js';
import { AppError } from '../middleware/errorHandler.js';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';


export const getAllCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const categories = await InventoryCategoryModel.find().sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const category = await InventoryCategoryModel.create(req.body);
    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const category = await InventoryCategoryModel.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!category) {
      throw new AppError('Category not found', 404);
    }

    res.json(category);
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    
    const itemsCount = await InventoryItemModel.countDocuments({ categoryId: id });
    if (itemsCount > 0) {
      throw new AppError(
        `Cannot delete category: ${itemsCount} item(s) are using this category`,
        400
      );
    }

    const category = await InventoryCategoryModel.findByIdAndDelete(id);
    if (!category) {
      throw new AppError('Category not found', 404);
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const getAllInventoryItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      categoryId,
      type,
      status,
      lowStock,
      search,
      page = '1',
      limit = '50',
    } = req.query;

    const query: any = {};

    if (categoryId) query.categoryId = categoryId;
    if (type) query.type = type;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const items = await InventoryItemModel.find(query)
      .populate('categoryId', 'name type')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limitNum);

    const total = await InventoryItemModel.countDocuments(query);

    let lowStockItems: any[] = [];
    if (lowStock === 'true') {
      lowStockItems = await InventoryItemModel.find({
        stockTracking: 'quantity',
        $expr: {
          $lte: ['$currentStock', '$minStockLevel'],
        },
      })
        .populate('categoryId', 'name type')
        .sort({ currentStock: 1 });
    }

    res.json({
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
      lowStockItems: lowStock === 'true' ? lowStockItems : undefined,
    });
  } catch (error) {
    next(error);
  }
};

export const getInventoryItemById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const item = await InventoryItemModel.findById(id).populate('categoryId', 'name type');

    if (!item) {
      throw new AppError('Inventory item not found', 404);
    }

    const assignments = await EquipmentAssignmentModel.find({
      inventoryItemId: id,
      isActive: true,
    }).populate('serviceInstanceId', 'name status');

    const maintenanceLogs = await MaintenanceLogModel.find({
      inventoryItemId: id,
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('performedBy', 'name username');

    const stockTransactions = await StockTransactionModel.find({
      inventoryItemId: id,
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('performedBy', 'name username');

    res.json({
      ...item.toObject(),
      assignments,
      maintenanceLogs,
      stockTransactions,
    });
  } catch (error) {
    next(error);
  }
};

export const createInventoryItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.body.sku) {
      const prefix = req.body.name.substring(0, 3).toUpperCase().replace(/\s/g, '');
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      req.body.sku = `${prefix}-${random}`;
    }

    const item = await InventoryItemModel.create(req.body);
    const populated = await InventoryItemModel.findById(item._id).populate('categoryId', 'name type');
    
    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
};

export const updateInventoryItem = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;

    let updateData = req.body;

    if (userRole === 'chef') {
      if (Object.keys(req.body).length > 1 || !('currentStock' in req.body)) {
        throw new AppError('Chefs can only update currentStock field', 403);
      }
      updateData = { currentStock: req.body.currentStock };
    }

    const item = await InventoryItemModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('categoryId', 'name type');

    if (!item) {
      throw new AppError('Inventory item not found', 404);
    }

    res.json(item);
  } catch (error) {
    next(error);
  }
};

export const deleteInventoryItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if item has active assignments
    const activeAssignments = await EquipmentAssignmentModel.countDocuments({
      inventoryItemId: id,
      isActive: true,
    });

    if (activeAssignments > 0) {
      throw new AppError(
        'Cannot delete item: It has active equipment assignments',
        400
      );
    }

    const item = await InventoryItemModel.findByIdAndDelete(id);
    if (!item) {
      throw new AppError('Inventory item not found', 404);
    }

    res.json({ message: 'Inventory item deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const bulkDeleteItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new AppError('Array of item IDs is required', 400);
    }

    const validIds = ids.filter((id: string) => id && typeof id === 'string');
    if (validIds.length === 0) {
      throw new AppError('No valid item IDs provided', 400);
    }

    const activeAssignments = await EquipmentAssignmentModel.countDocuments({
      inventoryItemId: { $in: validIds },
      isActive: true,
    });

    if (activeAssignments > 0) {
      throw new AppError(
        `Cannot delete ${activeAssignments} item(s): They have active equipment assignments`,
        400
      );
    }

    const result = await InventoryItemModel.deleteMany({
      _id: { $in: validIds },
    });

    res.json({
      message: `${result.deletedCount} item(s) deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    next(error);
  }
};

export const getEquipmentAssignments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { serviceInstanceId, inventoryItemId, active } = req.query;

    const query: any = {};
    if (serviceInstanceId) query.serviceInstanceId = serviceInstanceId;
    if (inventoryItemId) query.inventoryItemId = inventoryItemId;
    if (active !== undefined) query.isActive = active === 'true';

    const assignments = await EquipmentAssignmentModel.find(query)
      .populate('inventoryItemId', 'name sku type status')
      .populate('serviceInstanceId', 'name status')
      .populate('assignedBy', 'name username')
      .populate('unassignedBy', 'name username')
      .sort({ assignedAt: -1 });

    res.json(assignments);
  } catch (error) {
    next(error);
  }
};

export const assignEquipment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { inventoryItemId, serviceInstanceId, notes } = req.body;

    if (!inventoryItemId || !serviceInstanceId) {
      throw new AppError('inventoryItemId and serviceInstanceId are required', 400);
    }

    const item = await InventoryItemModel.findById(inventoryItemId);
    if (!item) {
      throw new AppError('Inventory item not found', 404);
    }

    if (item.status === 'retired' || item.status === 'maintenance') {
      throw new AppError(`Cannot assign item: Item status is ${item.status}`, 400);
    }

    const serviceInstance = await ActivityUnitModel.findById(serviceInstanceId);
    if (!serviceInstance) {
      throw new AppError('Service instance not found', 404);
    }

    const existingAssignment = await EquipmentAssignmentModel.findOne({
      inventoryItemId,
      isActive: true,
    });

    if (existingAssignment) {
      throw new AppError(
        'Item is already assigned to another service instance',
        400
      );
    }

    const assignment = await EquipmentAssignmentModel.create({
      inventoryItemId,
      serviceInstanceId,
      assignedBy: (req as any).user?._id,
      notes,
    });

    const populated = await EquipmentAssignmentModel.findById(assignment._id)
      .populate('inventoryItemId', 'name sku type status')
      .populate('serviceInstanceId', 'name status')
      .populate('assignedBy', 'name username');

    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
};

export const unassignEquipment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const assignment = await EquipmentAssignmentModel.findById(id);
    if (!assignment) {
      throw new AppError('Assignment not found', 404);
    }

    if (!assignment.isActive) {
      throw new AppError('Assignment is already inactive', 400);
    }

    assignment.isActive = false;
    assignment.unassignedAt = new Date();
    assignment.unassignedBy = (req as any).user?._id;
    await assignment.save();

    const populated = await EquipmentAssignmentModel.findById(assignment._id)
      .populate('inventoryItemId', 'name sku type status')
      .populate('serviceInstanceId', 'name status')
      .populate('unassignedBy', 'name username');

    res.json(populated);
  } catch (error) {
    next(error);
  }
};


export const getMaintenanceLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      inventoryItemId,
      serviceInstanceId,
      status,
      type,
      page = '1',
      limit = '50',
    } = req.query;

    const query: any = {};
    if (inventoryItemId) query.inventoryItemId = inventoryItemId;
    if (serviceInstanceId) query.serviceInstanceId = serviceInstanceId;
    if (status) query.status = status;
    if (type) query.type = type;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const logs = await MaintenanceLogModel.find(query)
      .populate('inventoryItemId', 'name sku')
      .populate('serviceInstanceId', 'name')
      .populate('performedBy', 'name username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await MaintenanceLogModel.countDocuments(query);

    res.json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createMaintenanceLog = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const log = await MaintenanceLogModel.create({
      ...req.body,
      performedBy: (req as any).user?._id,
    });

    const populated = await MaintenanceLogModel.findById(log._id)
      .populate('inventoryItemId', 'name sku')
      .populate('serviceInstanceId', 'name')
      .populate('performedBy', 'name username');

    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
};

export const updateMaintenanceLog = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const log = await MaintenanceLogModel.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    )
      .populate('inventoryItemId', 'name sku')
      .populate('serviceInstanceId', 'name')
      .populate('performedBy', 'name username');

    if (!log) {
      throw new AppError('Maintenance log not found', 404);
    }

    res.json(log);
  } catch (error) {
    next(error);
  }
};


export const getStockTransactions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      inventoryItemId,
      type,
      reason,
      startDate,
      endDate,
      page = '1',
      limit = '50',
    } = req.query;

    const query: any = {};
    if (inventoryItemId) query.inventoryItemId = inventoryItemId;
    if (type) query.type = type;
    if (reason) query.reason = reason;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate as string);
      if (endDate) query.createdAt.$lte = new Date(endDate as string);
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const transactions = await StockTransactionModel.find(query)
      .populate('inventoryItemId', 'name sku unit')
      .populate('performedBy', 'name username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await StockTransactionModel.countDocuments(query);

    res.json({
      transactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createStockTransaction = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { inventoryItemId, quantity, type, reason, unitPrice, notes } = req.body;

    if (!inventoryItemId || !quantity || !type || !reason) {
      throw new AppError('inventoryItemId, quantity, type, and reason are required', 400);
    }

    const item = await InventoryItemModel.findById(inventoryItemId);
    if (!item) {
      throw new AppError('Inventory item not found', 404);
    }

    const totalAmount = unitPrice ? unitPrice * Math.abs(quantity) : undefined;

    const transaction = await StockTransactionModel.create({
      inventoryItemId,
      quantity,
      type,
      reason,
      unitPrice,
      totalAmount,
      performedBy: (req as any).user?._id,
      notes,
    });

    if (item.stockTracking === 'quantity' && item.currentStock !== undefined) {
      const newStock = item.currentStock + quantity;
      if (newStock < 0) {
        throw new AppError('Insufficient stock', 400);
      }
      item.currentStock = newStock;
      await item.save();
    }

    const populated = await StockTransactionModel.findById(transaction._id)
      .populate('inventoryItemId', 'name sku unit currentStock')
      .populate('performedBy', 'name username');

    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
};


export const updateServiceInstance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const unit = await ActivityUnitModel.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate('activityId', 'name type');

    if (!unit) {
      throw new AppError('Service instance not found', 404);
    }

    const assignments = await EquipmentAssignmentModel.find({
      serviceInstanceId: id,
      isActive: true,
    }).populate('inventoryItemId', 'name sku type status');

    res.json({
      ...unit.toObject(),
      assignedEquipment: assignments.map(a => a.inventoryItemId),
    });
  } catch (error) {
    next(error);
  }
};

export const getServiceInstanceDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const unit = await ActivityUnitModel.findById(id).populate('activityId', 'name type');

    if (!unit) {
      throw new AppError('Service instance not found', 404);
    }

    const assignments = await EquipmentAssignmentModel.find({
      serviceInstanceId: id,
      isActive: true,
    })
      .populate('inventoryItemId', 'name sku type status brand itemModel')
      .populate('assignedBy', 'name username');

    const maintenanceLogs = await MaintenanceLogModel.find({
      serviceInstanceId: id,
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('performedBy', 'name username');

    res.json({
      ...unit.toObject(),
      assignedEquipment: assignments,
      maintenanceLogs,
    });
  } catch (error) {
    next(error);
  }
};

export const exportInventoryItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const items = await InventoryItemModel.find()
      .populate('categoryId', 'name')
      .sort({ name: 1 });

    const csvData = items.map((item: any) => ({
      name: item.name || '',
      sku: item.sku || '',
      category: item.categoryId?.name || '',
      type: item.type || '',
      description: item.description || '',
      brand: item.brand || '',
      itemModel: item.itemModel || '',
      status: item.status || '',
      stockTracking: item.stockTracking || '',
      currentStock: item.currentStock || '',
      minStockLevel: item.minStockLevel || '',
      maxStockLevel: item.maxStockLevel || '',
      unit: item.unit || '',
      location: item.location || '',
      costPrice: item.costPrice || '',
      sellingPrice: item.sellingPrice || '',
      purchaseDate: item.purchaseDate ? new Date(item.purchaseDate).toISOString().split('T')[0] : '',
      warrantyExpiry: item.warrantyExpiry ? new Date(item.warrantyExpiry).toISOString().split('T')[0] : '',
      serialNumber: item.serialNumber || '',
      barcode: item.barcode || '',
      notes: item.notes || '',
    }));

    const csv = stringify(csvData, {
      header: true,
      columns: [
        'name', 'sku', 'category', 'type', 'description', 'brand', 'itemModel',
        'status', 'stockTracking', 'currentStock', 'minStockLevel', 'maxStockLevel',
        'unit', 'location', 'costPrice', 'sellingPrice', 'purchaseDate',
        'warrantyExpiry', 'serialNumber', 'barcode', 'notes'
      ],
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=inventory-export.csv');
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

export const importInventoryItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as any[];

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      try {
        if (!record.name || !record.sku) {
          results.failed++;
          results.errors.push(`Row ${i + 2}: Missing required fields (name or SKU)`);
          continue;
        }

        let category = await InventoryCategoryModel.findOne({ name: record.category });
        if (!category && record.category) {
          category = await InventoryCategoryModel.create({
            name: record.category,
            type: record.type === 'equipment' ? 'gaming-equipment' : 'other',
          });
        }

        if (!category) {
          results.failed++;
          results.errors.push(`Row ${i + 2}: Category not found and could not be created`);
          continue;
        }

        const itemData: any = {
          name: record.name,
          sku: record.sku.toUpperCase(),
          categoryId: category._id,
          type: record.type || 'other',
          description: record.description || '',
          brand: record.brand || '',
          itemModel: record.itemModel || record.model || '',
          status: record.status || 'active',
          stockTracking: record.stockTracking || 'none',
          location: record.location || '',
          unit: record.unit || 'pieces',
          notes: record.notes || '',
        };

        if (record.currentStock) itemData.currentStock = parseFloat(record.currentStock);
        if (record.minStockLevel) itemData.minStockLevel = parseFloat(record.minStockLevel);
        if (record.maxStockLevel) itemData.maxStockLevel = parseFloat(record.maxStockLevel);
        if (record.costPrice) itemData.costPrice = parseFloat(record.costPrice);
        if (record.sellingPrice) itemData.sellingPrice = parseFloat(record.sellingPrice);
        if (record.purchaseDate) itemData.purchaseDate = new Date(record.purchaseDate);
        if (record.warrantyExpiry) itemData.warrantyExpiry = new Date(record.warrantyExpiry);
        if (record.serialNumber) itemData.serialNumber = record.serialNumber.toUpperCase();
        if (record.barcode) itemData.barcode = record.barcode;

        const existingItem = await InventoryItemModel.findOne({ sku: itemData.sku });
        if (existingItem) {
          await InventoryItemModel.findByIdAndUpdate(existingItem._id, { $set: itemData });
        } else {
          await InventoryItemModel.create(itemData);
        }

        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`Row ${i + 2}: ${error.message || 'Unknown error'}`);
      }
    }

    res.json({
      message: `Import completed: ${results.success} succeeded, ${results.failed} failed`,
      results,
    });
  } catch (error) {
    next(error);
  }
};
