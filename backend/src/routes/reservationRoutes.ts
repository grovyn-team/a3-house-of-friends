import { Router } from 'express';
import {
  createReservation,
  confirmReservation,
  getReservation,
} from '../controllers/reservationController.js';
import { validate, createSessionSchema } from '../middleware/validator.js';

const router = Router();

router.post('/', validate(createSessionSchema), createReservation);
router.get('/:id', getReservation);

router.post('/:id/confirm', confirmReservation);

export default router;

