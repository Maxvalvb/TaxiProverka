import { Request, Response, NextFunction } from 'express';
import supabase from '../services/supabase';
import { createError } from '../middleware/errorHandler';
import { AuthenticatedRequest, DriverState, UpdateDriverLocationRequest, UpdateDriverStateRequest } from '../types';
import { getDistance } from '../utils/helpers';

export const getAllDrivers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: drivers, error } = await supabase
      .from('drivers')
      .select(`
        *,
        user:users(*)
      `)
      .order('rating', { ascending: false });

    if (error) {
      return next(createError('Failed to fetch drivers', 500));
    }

    res.json({
      success: true,
      data: drivers
    });

  } catch (error) {
    console.error('Get drivers error:', error);
    next(createError('Failed to fetch drivers', 500));
  }
};

export const getAvailableDrivers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lng, radius = 10 } = req.query;

    let query = supabase
      .from('drivers')
      .select(`
        *,
        user:users(*)
      `)
      .eq('state', DriverState.ONLINE);

    const { data: drivers, error } = await query;

    if (error) {
      return next(createError('Failed to fetch available drivers', 500));
    }

    // Filter by distance if coordinates provided
    let filteredDrivers = drivers;
    if (lat && lng) {
      const clientLat = parseFloat(lat as string);
      const clientLng = parseFloat(lng as string);
      const maxRadius = parseFloat(radius as string);

      filteredDrivers = drivers.filter(driver => {
        const distance = getDistance(
          clientLat, 
          clientLng, 
          driver.location_lat, 
          driver.location_lng
        );
        return distance <= maxRadius;
      });

      // Sort by distance
      filteredDrivers.sort((a, b) => {
        const distanceA = getDistance(clientLat, clientLng, a.location_lat, a.location_lng);
        const distanceB = getDistance(clientLat, clientLng, b.location_lat, b.location_lng);
        return distanceA - distanceB;
      });
    }

    res.json({
      success: true,
      data: filteredDrivers
    });

  } catch (error) {
    console.error('Get available drivers error:', error);
    next(createError('Failed to fetch available drivers', 500));
  }
};

export const getDriverById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const { data: driver, error } = await supabase
      .from('drivers')
      .select(`
        *,
        user:users(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      return next(createError('Driver not found', 404));
    }

    res.json({
      success: true,
      data: driver
    });

  } catch (error) {
    console.error('Get driver error:', error);
    next(createError('Failed to fetch driver', 500));
  }
};

export const updateDriverLocation = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { lat, lng }: UpdateDriverLocationRequest = req.body;
    const driverId = req.driver?.id;

    if (!driverId) {
      return next(createError('Driver not found', 404));
    }

    const { data: updatedDriver, error } = await supabase
      .from('drivers')
      .update({
        location_lat: lat,
        location_lng: lng,
        updated_at: new Date().toISOString()
      })
      .eq('id', driverId)
      .select()
      .single();

    if (error) {
      return next(createError('Failed to update location', 500));
    }

    res.json({
      success: true,
      data: updatedDriver,
      message: 'Location updated successfully'
    });

  } catch (error) {
    console.error('Update location error:', error);
    next(createError('Failed to update location', 500));
  }
};

export const updateDriverState = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { state }: UpdateDriverStateRequest = req.body;
    const driverId = req.driver?.id;

    if (!driverId) {
      return next(createError('Driver not found', 404));
    }

    // Validate state transition
    const validStates = Object.values(DriverState);
    if (!validStates.includes(state)) {
      return next(createError('Invalid driver state', 400));
    }

    const { data: updatedDriver, error } = await supabase
      .from('drivers')
      .update({
        state,
        updated_at: new Date().toISOString()
      })
      .eq('id', driverId)
      .select()
      .single();

    if (error) {
      return next(createError('Failed to update state', 500));
    }

    res.json({
      success: true,
      data: updatedDriver,
      message: 'Driver state updated successfully'
    });

  } catch (error) {
    console.error('Update state error:', error);
    next(createError('Failed to update state', 500));
  }
};

export const updateDriverProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { car_model, license_plate } = req.body;
    const driverId = req.driver?.id;

    if (!driverId) {
      return next(createError('Driver not found', 404));
    }

    const updateData: any = {};
    if (car_model) updateData.car_model = car_model;
    if (license_plate) updateData.license_plate = license_plate;

    if (Object.keys(updateData).length === 0) {
      return next(createError('No data to update', 400));
    }

    const { data: updatedDriver, error } = await supabase
      .from('drivers')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', driverId)
      .select()
      .single();

    if (error) {
      return next(createError('Failed to update profile', 500));
    }

    res.json({
      success: true,
      data: updatedDriver,
      message: 'Driver profile updated successfully'
    });

  } catch (error) {
    console.error('Update driver profile error:', error);
    next(createError('Failed to update profile', 500));
  }
};

export const updateDriverEarnings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    if (typeof amount !== 'number' || amount < 0) {
      return next(createError('Invalid amount', 400));
    }

    // Get current earnings
    const { data: driver, error: fetchError } = await supabase
      .from('drivers')
      .select('earnings_today')
      .eq('id', id)
      .single();

    if (fetchError) {
      return next(createError('Driver not found', 404));
    }

    const newEarnings = driver.earnings_today + amount;

    const { data: updatedDriver, error } = await supabase
      .from('drivers')
      .update({
        earnings_today: newEarnings,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return next(createError('Failed to update earnings', 500));
    }

    res.json({
      success: true,
      data: updatedDriver,
      message: 'Earnings updated successfully'
    });

  } catch (error) {
    console.error('Update earnings error:', error);
    next(createError('Failed to update earnings', 500));
  }
};

export const getDriverStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const driverId = req.driver?.id;

    if (!driverId) {
      return next(createError('Driver not found', 404));
    }

    // Get driver data
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', driverId)
      .single();

    if (driverError) {
      return next(createError('Driver not found', 404));
    }

    // Get completed rides count
    const { count: ridesCount, error: ridesError } = await supabase
      .from('rides')
      .select('*', { count: 'exact', head: true })
      .eq('driver_id', driverId)
      .eq('status', 'COMPLETED');

    if (ridesError) {
      console.error('Failed to get rides count:', ridesError);
    }

    // Get total earnings (sum of completed rides)
    const { data: earnings, error: earningsError } = await supabase
      .from('rides')
      .select('fare')
      .eq('driver_id', driverId)
      .eq('status', 'COMPLETED');

    let totalEarnings = 0;
    if (!earningsError && earnings) {
      totalEarnings = earnings.reduce((sum, ride) => sum + ride.fare, 0);
    }

    const stats = {
      earningsToday: driver.earnings_today,
      totalEarnings,
      completedRides: ridesCount || 0,
      rating: driver.rating,
      state: driver.state
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get driver stats error:', error);
    next(createError('Failed to get driver stats', 500));
  }
};