import { Router } from 'express';
import { getQueue, getStations, getQueueStats, assignQueueEntry, removeQueueEntry } from '../controllers/queueController.js';
import { authenticate, requireStaff } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, getQueue);
router.get('/stations', authenticate, getStations);
router.get('/stats', authenticate, getQueueStats);
router.post('/assign', authenticate, requireStaff, assignQueueEntry);
router.post('/remove', authenticate, requireStaff, removeQueueEntry);

export default router;

