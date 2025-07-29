import { Router } from 'express';
import { login, register, getProfile } from '../controllers/authController';
import { validateLoginData, validateRegisterData } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/login', validateLoginData, login);
router.post('/register', validateRegisterData, register);

// Protected routes
router.get('/profile', authenticateToken, getProfile);

export default router;