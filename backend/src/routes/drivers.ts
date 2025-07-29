import { Router } from 'express';
import {
  getAllDrivers,
  getAvailableDrivers,
  getDriverById,
  updateDriverLocation,
  updateDriverState,
  updateDriverProfile,
  updateDriverEarnings,
  getDriverStats
} from '../controllers/driverController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateLocationData, validateDriverData } from '../middleware/validation';
import { UserMode } from '../types';

const router = Router();

// Public routes
router.get('/', getAllDrivers);
router.get('/available', getAvailableDrivers);
router.get('/:id', getDriverById);

// Protected routes - Driver only
router.put('/location', authenticateToken, requireRole([UserMode.DRIVER]), validateLocationData, updateDriverLocation);
router.put('/state', authenticateToken, requireRole([UserMode.DRIVER]), updateDriverState);
router.put('/profile', authenticateToken, requireRole([UserMode.DRIVER]), validateDriverData, updateDriverProfile);
router.get('/me/stats', authenticateToken, requireRole([UserMode.DRIVER]), getDriverStats);

// Protected routes - Admin only
router.put('/:id/earnings', authenticateToken, requireRole([UserMode.ADMIN]), updateDriverEarnings);

export default router;