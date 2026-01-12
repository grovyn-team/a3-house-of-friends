import { Router } from 'express';
import {
  getAllActivities,
  getActivityById,
  createActivity,
  updateActivity,
  deleteActivity,
  createUnit,
  updateUnitStatus,
  updateUnit,
  deleteUnit,
} from '../controllers/activityController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', getAllActivities);
router.get('/:id', getActivityById);

router.post('/', authenticate, requireAdmin, createActivity);
router.put('/:id', authenticate, requireAdmin, updateActivity);
router.delete('/:id', authenticate, requireAdmin, deleteActivity);
router.post('/:activityId/units', authenticate, requireAdmin, createUnit);
router.put('/units/:unitId/status', authenticate, requireAdmin, updateUnitStatus);
router.put('/units/:unitId', authenticate, requireAdmin, updateUnit);
router.delete('/units/:unitId', authenticate, requireAdmin, deleteUnit);

export default router;

