import { Router } from 'express';
import {
  createRide,
  getRideById,
  getUserRides,
  getDriverRides,
  assignDriverToRide,
  findNearestDriver,
  updateRideStatus,
  cancelRide
} from '../controllers/rideController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateRideData } from '../middleware/validation';
import { UserMode } from '../types';

const router = Router();

// Protected routes - All authenticated users
router.get('/:id', authenticateToken, getRideById);

// Protected routes - Client only
router.post('/', authenticateToken, requireRole([UserMode.CLIENT]), validateRideData, createRide);
router.get('/user/me', authenticateToken, requireRole([UserMode.CLIENT]), getUserRides);
router.delete('/:id/cancel', authenticateToken, requireRole([UserMode.CLIENT]), cancelRide);

// Protected routes - Driver only
router.get('/driver/me', authenticateToken, requireRole([UserMode.DRIVER]), getDriverRides);

// Protected routes - Admin/System
router.post('/:rideId/assign/:driverId', authenticateToken, requireRole([UserMode.ADMIN]), assignDriverToRide);
router.post('/:rideId/find-driver', findNearestDriver);
router.put('/:id/status', updateRideStatus);

export default router;