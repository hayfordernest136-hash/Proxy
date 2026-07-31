import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, logout, me, updateProfile } from '../controllers/auth.controller';
import { googleAuth } from '../controllers/google.controller';

const router = Router();

// Rate limit login attempts: 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' },
});

// Rate limit registration: 3 attempts per hour per IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many registration attempts. Please try again later.' },
});

router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);
router.post('/google', googleAuth);
router.post('/logout', logout);
router.patch('/profile', updateProfile);
router.get('/me', me);

export default router;
