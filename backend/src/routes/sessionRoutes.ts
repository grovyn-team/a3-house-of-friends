import { Router } from 'express';
import {
  createSession,
  createChallengeSession,
  getSession,
  getActiveSessions,
  getAllSessions,
  extendSession,
  endSession,
  getSessionsByPhone,
  pauseSession,
  resumeSession,
  voteWinner,
  selectWinner,
  deleteSession,
} from '../controllers/sessionController.js';
import { authenticate, requireStaff } from '../middleware/auth.js';
import { validate, createSessionSchema } from '../middleware/validator.js';

const router = Router();

router.post('/', validate(createSessionSchema), createSession);
router.post('/challenge', createChallengeSession);
router.get('/phone/:phone', getSessionsByPhone);

router.post('/:id/pause', pauseSession);
router.post('/:id/resume', resumeSession);
router.post('/:id/vote-winner', voteWinner);
router.post('/:id/end', endSession);

router.get('/history', authenticate, requireStaff, getAllSessions);
router.get('/', authenticate, requireStaff, getActiveSessions);
router.post('/:id/extend', authenticate, requireStaff, extendSession);
router.post('/:id/select-winner', authenticate, requireStaff, selectWinner);
router.delete('/:id', authenticate, requireStaff, deleteSession);

router.get('/:id', getSession);

export default router;

