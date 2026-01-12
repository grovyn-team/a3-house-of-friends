import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { AppError } from './errorHandler.js';

export const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
        }));
        res.status(400).json({ error: 'Validation failed', details: errors });
        return;
      }
      next(error);
    }
  };
};

// Common validation schemas
export const loginSchema = z.object({
  body: z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const registerSchema = z.object({
  body: z.object({
    username: z.string().min(3, 'Username must be at least 3 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    name: z.string().min(1, 'Name is required'),
    role: z.enum(['admin', 'staff']).optional(),
  }),
});

export const createSessionSchema = z.object({
  body: z.object({
    activityId: z.string().min(1, 'Activity ID is required'), // Accepts both UUID, ObjectId, and type strings
    unitId: z.string().min(1, 'Unit ID is required'), // Accepts both UUID and ObjectId
    customerName: z.string().min(1, 'Customer name is required'),
    customerPhone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
    duration: z.number().int().min(1, 'Duration must be at least 1 minute'),
    qrContext: z.object({
      branchId: z.string().optional(),
      zoneId: z.string().optional(),
      tableId: z.string().optional(),
    }).optional(),
  }),
});

export const createOrderSchema = z.object({
  body: z.object({
    items: z.array(z.object({
      menuItemId: z.string().min(1, 'Menu item ID is required'), // Accepts both UUID and ObjectId
      quantity: z.number().int().min(1),
      notes: z.string().optional(),
    })).min(1, 'At least one item is required'),
    customerName: z.string().min(1, 'Customer name is required'),
    customerPhone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
    qrContext: z.object({
      branchId: z.string().optional(),
      zoneId: z.string().optional(),
      tableId: z.string().optional(),
    }).optional(),
    sessionId: z.string().min(1).optional(), // Accepts both UUID and ObjectId
  }),
});

