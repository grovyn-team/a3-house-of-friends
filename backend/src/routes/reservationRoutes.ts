import { Router } from 'express';
import {
  createReservation,
  confirmReservation,
  getReservation,
  joinWaitingQueue,
  exitWaitingQueue,
} from '../controllers/reservationController.js';
import { validate, createSessionSchema, joinQueueSchema, exitQueueSchema, confirmReservationSchema } from '../middleware/validator.js';

const router = Router();

router.post('/', validate(createSessionSchema), createReservation);
router.post('/join-queue', validate(joinQueueSchema), joinWaitingQueue);
router.post('/exit-queue', validate(exitQueueSchema), exitWaitingQueue);
router.get('/:id', getReservation);

router.post('/:id/confirm', validate(confirmReservationSchema), confirmReservation);

export default router;

