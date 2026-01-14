import { Request, Response, NextFunction } from 'express';
import { SessionModel } from '../models/Session.js';
import { FoodOrderModel } from '../models/Order.js';
import { ActivityModel } from '../models/Activity.js';
import { stringify } from 'csv-stringify/sync';

export const exportRevenueData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate: startDateParam, endDate: endDateParam } = req.query;
    
    const sessionQuery: any = {
      paymentStatus: { $in: ['paid', 'offline'] },
    };

    const orderQuery: any = {
      paymentStatus: { $in: ['paid', 'offline'] },
    };

    let start = startDateParam ? new Date(startDateParam as string) : new Date(0);
    let end = endDateParam ? new Date(endDateParam as string) : new Date();
    
    if (startDateParam && endDateParam) {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      
      sessionQuery.createdAt = { $gte: start, $lte: end };
      orderQuery.createdAt = { $gte: start, $lte: end };
    }

    const pageSize = 100;
    let allSessions: any[] = [];
    let allOrders: any[] = [];

    const sessionCount = await SessionModel.countDocuments(sessionQuery);
    const orderCount = await FoodOrderModel.countDocuments(orderQuery);
    
    const sessionPages = Math.ceil(sessionCount / pageSize);
    const orderPages = Math.ceil(orderCount / pageSize);

    for (let page = 0; page < sessionPages; page++) {
      const sessions = await SessionModel.find(sessionQuery)
        .populate('activityId', 'type name')
        .sort({ createdAt: 1 })
        .skip(page * pageSize)
        .limit(pageSize);
      
      allSessions = allSessions.concat(sessions);
    }

    for (let page = 0; page < orderPages; page++) {
      const orders = await FoodOrderModel.find(orderQuery)
        .sort({ createdAt: 1 })
        .skip(page * pageSize)
        .limit(pageSize);
      
      allOrders = allOrders.concat(orders);
    }

    const activityMap = new Map();
    const activityIds = [...new Set(allSessions.map(s => s.activityId?.toString()))];
    const activities = await ActivityModel.find({
      _id: { $in: activityIds.filter(id => id).map(id => id as any) },
    });
    activities.forEach(a => activityMap.set(a._id.toString(), a.type || a.name));

    const csvData: any[] = [];

    allSessions.forEach((session: any) => {
      csvData.push({
        date: new Date(session.createdAt).toISOString().split('T')[0],
        type: 'Session',
        category: activityMap.get(session.activityId?.toString()) || session.activityType || 'Unknown',
        customerName: session.customerName || '',
        customerPhone: session.customerPhone || '',
        description: `${session.duration || 0} minutes`,
        paymentMethod: session.paymentStatus === 'offline' ? 'Offline' : 'Online',
        amount: session.finalAmount || session.amount || 0,
        paymentStatus: session.paymentStatus || '',
      });
    });

    allOrders.forEach((order: any) => {
      const itemsList = order.items?.map((item: any) => 
        `${item.menuItemId?.name || 'Unknown'} x${item.quantity || 1}`
      ).join(', ') || '';
      
      csvData.push({
        date: new Date(order.createdAt).toISOString().split('T')[0],
        type: 'Food & Beverages',
        category: 'Food & Beverages',
        customerName: order.customerName || '',
        customerPhone: order.customerPhone || '',
        description: itemsList,
        paymentMethod: order.paymentStatus === 'offline' ? 'Offline' : 'Online',
        amount: order.totalAmount || 0,
        paymentStatus: order.paymentStatus || '',
      });
    });

    csvData.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });

    const csv = stringify(csvData, {
      header: true,
      columns: ['date', 'type', 'category', 'customerName', 'customerPhone', 'description', 'paymentMethod', 'amount', 'paymentStatus'],
    });

    const filename = `revenue-export-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

export const getRevenueData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate, page = '1', limit = '50' } = req.query;
    
    const sessionQuery: any = {
      paymentStatus: { $in: ['paid', 'offline'] },
    };

    const orderQuery: any = {
      paymentStatus: { $in: ['paid', 'offline'] },
    };

    // Only apply date filters if both dates are provided
    if (startDate && endDate) {
      let start = new Date(startDate as string);
      start.setHours(0, 0, 0, 0);
      
      let end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      
      sessionQuery.createdAt = { $gte: start, $lte: end };
      orderQuery.createdAt = { $gte: start, $lte: end };
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const sessionTotal = await SessionModel.countDocuments(sessionQuery);
    const orderTotal = await FoodOrderModel.countDocuments(orderQuery);
    const totalRecords = sessionTotal + orderTotal;

    const sessions = await SessionModel.find(sessionQuery)
      .populate('activityId', 'type name')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip);

    const orders = await FoodOrderModel.find(orderQuery)
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip);

    const allData = [
      ...sessions.map((s: any) => ({
        id: s._id.toString(),
        date: s.createdAt,
        type: 'session',
        category: s.activityId?.type || s.activityType || 'Unknown',
        customerName: s.customerName,
        customerPhone: s.customerPhone,
        description: `${s.duration || 0} minutes`,
        amount: s.finalAmount || s.amount || 0,
        paymentStatus: s.paymentStatus,
        paymentMethod: s.paymentStatus === 'offline' ? 'Offline' : 'Online',
      })),
      ...orders.map((o: any) => ({
        id: o._id.toString(),
        date: o.createdAt,
        type: 'order',
        category: 'Food & Beverages',
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        description: `${o.items?.length || 0} items`,
        amount: o.totalAmount || 0,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentStatus === 'offline' ? 'Offline' : 'Online',
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limitNum);

    const sessionRevenue = await SessionModel.aggregate([
      { $match: sessionQuery },
      { $group: { 
        _id: null, 
        total: { 
          $sum: { 
            $ifNull: ['$finalAmount', { $ifNull: ['$amount', 0] }]
          }
        } 
      } },
    ]);

    const orderRevenue = await FoodOrderModel.aggregate([
      { $match: orderQuery },
      { $group: { 
        _id: null, 
        total: { 
          $sum: { $ifNull: ['$totalAmount', 0] } 
        } 
      } },
    ]);

    const totalRevenue = (sessionRevenue[0]?.total || 0) + (orderRevenue[0]?.total || 0);

    res.json({
      data: allData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalRecords,
        pages: Math.ceil(totalRecords / limitNum),
      },
      summary: {
        totalRevenue,
        sessionRevenue: sessionRevenue[0]?.total || 0,
        orderRevenue: orderRevenue[0]?.total || 0,
        sessionCount: sessionTotal,
        orderCount: orderTotal,
      },
    });
  } catch (error) {
    next(error);
  }
};
