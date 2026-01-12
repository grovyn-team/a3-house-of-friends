import { Router } from 'express';
import {
  createPaymentOrder,
  verifyPayment,
  markOfflinePayment,
  handleWebhook,
} from '../controllers/paymentController.js';
import { authenticate, requireStaff } from '../middleware/auth.js';

const router = Router();

router.post('/create-order', createPaymentOrder);
router.post('/verify', verifyPayment);
router.post('/offline', markOfflinePayment);
router.post('/webhook', handleWebhook);

export default router;

