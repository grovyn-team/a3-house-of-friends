import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ActivityModel, ActivityUnitModel } from '../models/Activity.js';
import { SessionModel } from '../models/Session.js';
import { AppError } from '../middleware/errorHandler.js';

export const getAllActivities = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const enabledOnly = req.query.enabled === 'true';
    const query = enabledOnly ? { enabled: true } : {};
    
    const activities = await ActivityModel.find(query).sort({ name: 1 });
    const activitiesWithUnits = await Promise.all(
      activities.map(async (activity) => {
        const units = await ActivityUnitModel.find({ activityId: activity._id });
        return {
          id: activity.type, 
          _id: activity._id.toString(),
          type: activity.type,
          name: activity.name,
          description: activity.description,
          pricingType: activity.pricingType,
          baseRate: activity.baseRate,
          duration: activity.duration,
          minimumDuration: activity.minimumDuration,
          peakMultiplier: activity.peakMultiplier,
          bufferTime: activity.bufferTime,
          enabled: activity.enabled,
          units: units.map(unit => ({
            id: unit._id.toString(),
            name: unit.name,
            status: unit.status,
            activityId: activity.type,
          })),
        };
      })
    );

    res.json(activitiesWithUnits);
  } catch (error) {
    next(error);
  }
};

export const getActivityById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    
    let activity;
    if (mongoose.Types.ObjectId.isValid(id)) {
      activity = await ActivityModel.findById(id);
    } else {
      activity = await ActivityModel.findOne({ type: id });
    }

    if (!activity) {
      throw new AppError('Activity not found', 404);
    }

    const units = await ActivityUnitModel.find({ activityId: activity._id });

    res.json({
      id: activity.type,
      _id: activity._id.toString(),
      type: activity.type,
      name: activity.name,
      description: activity.description,
      pricingType: activity.pricingType,
      baseRate: activity.baseRate,
      duration: activity.duration,
      minimumDuration: activity.minimumDuration,
      peakMultiplier: activity.peakMultiplier,
      bufferTime: activity.bufferTime,
      enabled: activity.enabled,
      units: units.map(unit => ({
        id: unit._id.toString(),
        name: unit.name,
        status: unit.status,
        activityId: activity.type,
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const createActivity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const activity = await ActivityModel.create(req.body);
    res.status(201).json({
      id: activity._id.toString(),
      ...activity.toObject(),
    });
  } catch (error) {
    next(error);
  }
};

export const updateActivity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const activity = await ActivityModel.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!activity) {
      throw new AppError('Activity not found', 404);
    }

    res.json({
      id: activity._id.toString(),
      ...activity.toObject(),
    });
  } catch (error) {
    next(error);
  }
};

export const deleteActivity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const activity = await ActivityModel.findByIdAndDelete(id);

    if (!activity) {
      throw new AppError('Activity not found', 404);
    }

    res.json({ message: 'Activity deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const createUnit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { activityId } = req.params;
    const { name } = req.body;

    if (!name) {
      throw new AppError('Unit name is required', 400);
    }

    const unit = await ActivityUnitModel.create({
      activityId,
      name,
    });
    
    res.status(201).json({
      id: unit._id.toString(),
      activityId: unit.activityId.toString(),
      name: unit.name,
      status: unit.status,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUnitStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { unitId } = req.params;
    const { status } = req.body;

    if (!['available', 'occupied', 'maintenance'].includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    const unit = await ActivityUnitModel.findByIdAndUpdate(
      unitId,
      { $set: { status } },
      { new: true }
    ).populate('activityId', 'name type');

    if (!unit) {
      throw new AppError('Unit not found', 404);
    }

    res.json({
      id: unit._id.toString(),
      activityId: unit.activityId.toString(),
      name: unit.name,
      status: unit.status,
      location: unit.location,
      notes: unit.notes,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUnit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { unitId } = req.params;
    const { name, status, location, notes } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (status !== undefined) {
      if (!['available', 'occupied', 'maintenance'].includes(status)) {
        throw new AppError('Invalid status', 400);
      }
      updateData.status = status;
    }
    if (location !== undefined) updateData.location = location;
    if (notes !== undefined) updateData.notes = notes;

    const unit = await ActivityUnitModel.findByIdAndUpdate(
      unitId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('activityId', 'name type');

    if (!unit) {
      throw new AppError('Unit not found', 404);
    }

    res.json({
      id: unit._id.toString(),
      activityId: unit.activityId.toString(),
      name: unit.name,
      status: unit.status,
      location: unit.location,
      notes: unit.notes,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUnit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { unitId } = req.params;

    const activeSessions = await SessionModel.countDocuments({
      unitId,
      status: { $in: ['active', 'paused', 'scheduled'] },
    });

    if (activeSessions > 0) {
      throw new AppError(
        'Cannot delete unit: It has active or scheduled sessions',
        400
      );
    }

    const unit = await ActivityUnitModel.findByIdAndDelete(unitId);
    if (!unit) {
      throw new AppError('Unit not found', 404);
    }

    res.json({ message: 'Unit deleted successfully' });
  } catch (error) {
    next(error);
  }
};
