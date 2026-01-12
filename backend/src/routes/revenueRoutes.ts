import { Router } from 'express';
import { getRevenueData, exportRevenueData } from '../controllers/revenueController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, getRevenueData);
router.get('/export', authenticate, requireAdmin, exportRevenueData);

export default router;
