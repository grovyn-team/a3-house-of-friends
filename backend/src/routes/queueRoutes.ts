import { Router } from 'express';
import { getQueue, getStations, getQueueStats, assignQueueEntry, removeQueueEntry } from '../controllers/queueController.js';
import {
  getPendingApprovals,
  approveCashPayment,
  rejectCashPayment,
  getWaitingQueue,
  processQueue,
  getQueueStatusByReservation,
} from '../controllers/approvalController.js';
import { authenticate, requireStaff } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, getQueue);
router.get('/stations', authenticate, getStations);
router.get('/stats', authenticate, getQueueStats);
router.post('/assign', authenticate, requireStaff, assignQueueEntry);
router.post('/remove', authenticate, requireStaff, removeQueueEntry);

router.get('/approvals', authenticate, requireStaff, getPendingApprovals);
router.post('/approve', authenticate, requireStaff, approveCashPayment);
router.post('/reject', authenticate, requireStaff, rejectCashPayment);

router.get('/waiting', authenticate, requireStaff, getWaitingQueue);
router.post('/process', authenticate, requireStaff, processQueue);
router.get('/status/:reservationId', authenticate, getQueueStatusByReservation);

export default router;

