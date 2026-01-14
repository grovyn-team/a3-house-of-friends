import { Router } from 'express';
import {
  createReservation,
  confirmReservation,
  getReservation,
  joinWaitingQueue,
  exitWaitingQueue,
} from '../controllers/reservationController.js';
import { validate, createSessionSchema } from '../middleware/validator.js';

const router = Router();

router.post('/', validate(createSessionSchema), createReservation);
router.post('/join-queue', joinWaitingQueue);
router.post('/exit-queue', exitWaitingQueue);
router.get('/:id', getReservation);

router.post('/:id/confirm', confirmReservation);

export default router;

