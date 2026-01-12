import { Router } from 'express';
import { login, register, getProfile } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate, loginSchema, registerSchema } from '../middleware/validator.js';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/profile', authenticate, getProfile);

export default router;

