import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { MenuItemModel, FoodOrderModel } from '../models/Order.js';
import { AppError } from '../middleware/errorHandler.js';

export const getAllMenuItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const availableOnly = req.query.available === 'true';
    const query = availableOnly ? { available: true } : {};
    
    const items = await MenuItemModel.find(query).sort({ category: 1, name: 1 });
    
    res.json(items.map(item => ({
      id: item.name.toLowerCase().replace(/\s+/g, '-'), // Use name as ID for frontend compatibility
      _id: item._id.toString(), // Also include MongoDB _id
      name: item.name,
      category: item.category,
      description: item.description,
      price: item.price,
      available: item.available,
      imageUrl: item.imageUrl,
    })));
  } catch (error) {
    next(error);
  }
};

export const getMenuItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const item = await MenuItemModel.findById(id);

    if (!item) {
      throw new AppError('Menu item not found', 404);
    }

    res.json({
      id: item._id.toString(),
      name: item.name,
      category: item.category,
      description: item.description,
      price: item.price,
      available: item.available,
      imageUrl: item.imageUrl,
    });
  } catch (error) {
    next(error);
  }
};

export const createMenuItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const item = await MenuItemModel.create(req.body);
    res.status(201).json({
      id: item._id.toString(),
      ...item.toObject(),
    });
  } catch (error) {
    next(error);
  }
};

export const createOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { items, customerName, customerPhone, qrContext, sessionId } = req.body;

    const orderItems = await Promise.all(
      items.map(async (item: any) => {
        let menuItem;
        if (mongoose.Types.ObjectId.isValid(item.menuItemId)) {
          menuItem = await MenuItemModel.findById(item.menuItemId);
        } else {
          const searchName = item.menuItemId
            .split('-')
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          
          menuItem = await MenuItemModel.findOne({ 
            $or: [
              { name: { $regex: new RegExp(`^${searchName}$`, 'i') } },
              { name: { $regex: new RegExp(item.menuItemId.replace(/-/g, ' '), 'i') } },
              { name: item.menuItemId }
            ]
          });
        }
        
        if (!menuItem) {
          throw new AppError(`Menu item ${item.menuItemId} not found`, 404);
        }
        if (!menuItem.available) {
          throw new AppError(`Menu item ${menuItem.name} is not available`, 400);
        }

        return {
          menuItemId: menuItem._id,
          quantity: item.quantity,
          price: menuItem.price,
          notes: item.notes || null,
        };
      })
    );

    const totalAmount = orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const order = await FoodOrderModel.create({
      items: orderItems,
      totalAmount,
      customerName,
      customerPhone,
      qrContext: qrContext || {},
      sessionId: sessionId || undefined,
    });

    const { getIO, broadcastQueueUpdate } = await import('../websocket/server.js');
    const io = getIO();
    if (io) {
      io.of('/admin').emit('order_created', {
        orderId: order._id.toString(),
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        amount: order.totalAmount,
        itemCount: order.items.length,
        qrContext: order.qrContext,
        timestamp: new Date().toISOString(),
      });
      broadcastQueueUpdate();
    }

    res.status(201).json({
      id: order._id.toString(),
      items: order.items.map(item => ({
        menuItemId: item.menuItemId.toString(),
        quantity: item.quantity,
        price: item.price,
        notes: item.notes,
      })),
      totalAmount: order.totalAmount,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      qrContext: order.qrContext,
      sessionId: order.sessionId?.toString(),
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
    });
  } catch (error) {
    next(error);
  }
};

export const getOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const order = await FoodOrderModel.findById(id);

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    res.json({
      id: order._id.toString(),
      items: order.items.map(item => ({
        menuItemId: item.menuItemId.toString(),
        quantity: item.quantity,
        price: item.price,
        notes: item.notes,
      })),
      totalAmount: order.totalAmount,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      qrContext: order.qrContext,
      sessionId: order.sessionId?.toString(),
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentId: order.paymentId,
      razorpayOrderId: order.razorpayOrderId,
      estimatedReadyTime: order.estimatedReadyTime,
      createdAt: order.createdAt,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const orders = await FoodOrderModel.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset);

    res.json(orders.map(order => ({
      id: order._id.toString(),
      items: order.items,
      totalAmount: order.totalAmount,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
    })));
  } catch (error) {
    next(error);
  }
};

export const getPendingOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const orders = await FoodOrderModel.find({
      status: { $in: ['pending', 'preparing', 'ready'] },
    }).sort({ createdAt: 1 });

    res.json(orders.map(order => ({
      id: order._id.toString(),
      _id: order._id.toString(),
      items: order.items,
      totalAmount: order.totalAmount,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      status: order.status,
      createdAt: order.createdAt,
      paymentStatus: order.paymentStatus,
    })));
  } catch (error) {
    next(error);
  }
};

export const updateOrderStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, estimatedReadyTime } = req.body;

    if (status && !['pending', 'preparing', 'ready', 'served', 'cancelled'].includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (estimatedReadyTime) updateData.estimatedReadyTime = new Date(estimatedReadyTime);

    const order = await FoodOrderModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    ).populate('sessionId');

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    if (updateData.status) {
      const { getIO, notifyCustomerByPhone, notifyCustomerById } = await import('../websocket/server.js');
      const io = getIO();
      
      const statusMessages: Record<string, string> = {
        preparing: 'Your order is now being prepared!',
        ready: 'Your order is ready for pickup!',
        served: 'Your order has been served!',
        cancelled: 'Your order has been cancelled.',
      };
      
      const message = statusMessages[updateData.status] || 'Your order status has been updated.';
      
      notifyCustomerByPhone(order.customerPhone, 'order_status_update', {
        type: 'order',
        orderId: order._id.toString(),
        status: order.status,
        message,
        timestamp: new Date().toISOString(),
      });
      
      notifyCustomerById(order._id.toString(), 'order', {
        type: 'order',
        orderId: order._id.toString(),
        status: order.status,
        message,
        timestamp: new Date().toISOString(),
      });

      io.of('/admin').emit('queue_updated', {
        type: 'order',
        orderId: order._id.toString(),
        status: order.status,
      });
    }

    res.json({
      id: order._id.toString(),
      status: order.status,
      estimatedReadyTime: order.estimatedReadyTime,
    });
  } catch (error) {
    next(error);
  }
};

export const getOrdersByPhone = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { phone } = req.params;
    const orders = await FoodOrderModel.find({ customerPhone: phone })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json(orders.map(order => ({
      id: order._id.toString(),
      items: order.items,
      totalAmount: order.totalAmount,
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
    })));
  } catch (error) {
    next(error);
  }
};
