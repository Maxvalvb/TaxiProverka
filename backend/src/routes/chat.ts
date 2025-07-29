import { Router } from 'express';
import { sendMessage, getRideMessages } from '../controllers/chatController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Chat messages
router.post('/messages', sendMessage);
router.get('/rides/:rideId/messages', getRideMessages);

export default router;