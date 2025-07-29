import { Router } from 'express';
import {
  updateProfile,
  getPaymentCards,
  addPaymentCard,
  deletePaymentCard,
  updateWalletBalance
} from '../controllers/userController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Profile management
router.put('/profile', updateProfile);

// Payment cards
router.get('/payment-cards', getPaymentCards);
router.post('/payment-cards', addPaymentCard);
router.delete('/payment-cards/:id', deletePaymentCard);

// Wallet
router.put('/wallet/balance', updateWalletBalance);

export default router;