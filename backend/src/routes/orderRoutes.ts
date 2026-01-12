import { Router } from 'express';
import {
  getAllMenuItems,
  getMenuItem,
  createMenuItem,
  createOrder,
  getOrder,
  getAllOrders,
  getPendingOrders,
  updateOrderStatus,
  getOrdersByPhone,
} from '../controllers/orderController.js';
import { authenticate, requireAdmin, requireStaff, requireChef } from '../middleware/auth.js';
import { validate, createOrderSchema } from '../middleware/validator.js';

const router = Router();

router.get('/menu', getAllMenuItems);
router.get('/menu/:id', getMenuItem);
router.post('/', validate(createOrderSchema), createOrder);
router.get('/phone/:phone', getOrdersByPhone);

router.get('/', authenticate, requireStaff, getAllOrders);
router.get('/pending', authenticate, requireChef, getPendingOrders);
router.put('/:id/status', authenticate, requireChef, updateOrderStatus);

router.get('/:id', getOrder);

router.post('/menu', authenticate, requireAdmin, createMenuItem);

export default router;

