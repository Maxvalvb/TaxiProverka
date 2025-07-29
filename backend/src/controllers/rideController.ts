import { Request, Response, NextFunction } from 'express';
import supabase from '../services/supabase';
import { createError } from '../middleware/errorHandler';
import { AuthenticatedRequest, CreateRideRequest, RideStatus, DriverState, UserMode } from '../types';
import { getDistance } from '../utils/helpers';

export const createRide = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      pickup_address,
      destination_address,
      pickup_lat,
      pickup_lng,
      destination_lat,
      destination_lng,
      fare,
      ride_type
    }: CreateRideRequest = req.body;

    const clientId = req.user?.id;

    if (!clientId) {
      return next(createError('User not authenticated', 401));
    }

    // Create ride
    const rideData = {
      client_id: clientId,
      pickup_address,
      destination_address,
      pickup_lat,
      pickup_lng,
      destination_lat,
      destination_lng,
      fare,
      ride_type,
      status: RideStatus.PENDING
    };

    const { data: ride, error } = await supabase
      .from('rides')
      .insert(rideData)
      .select(`
        *,
        client:users!rides_client_id_fkey(*)
      `)
      .single();

    if (error) {
      return next(createError('Failed to create ride', 500));
    }

    res.status(201).json({
      success: true,
      data: ride,
      message: 'Ride created successfully'
    });

  } catch (error) {
    console.error('Create ride error:', error);
    next(createError('Failed to create ride', 500));
  }
};

export const getRideById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const { data: ride, error } = await supabase
      .from('rides')
      .select(`
        *,
        client:users!rides_client_id_fkey(*),
        driver:drivers(*, user:users(*))
      `)
      .eq('id', id)
      .single();

    if (error) {
      return next(createError('Ride not found', 404));
    }

    res.json({
      success: true,
      data: ride
    });

  } catch (error) {
    console.error('Get ride error:', error);
    next(createError('Failed to fetch ride', 500));
  }
};

export const getUserRides = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { status, page = 1, limit = 10 } = req.query;

    if (!userId) {
      return next(createError('User not authenticated', 401));
    }

    let query = supabase
      .from('rides')
      .select(`
        *,
        client:users!rides_client_id_fkey(*),
        driver:drivers(*, user:users(*))
      `)
      .eq('client_id', userId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const offset = (Number(page) - 1) * Number(limit);
    query = query.range(offset, offset + Number(limit) - 1);

    const { data: rides, error } = await query;

    if (error) {
      return next(createError('Failed to fetch rides', 500));
    }

    res.json({
      success: true,
      data: rides
    });

  } catch (error) {
    console.error('Get user rides error:', error);
    next(createError('Failed to fetch rides', 500));
  }
};

export const getDriverRides = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const driverId = req.driver?.id;
    const { status, page = 1, limit = 10 } = req.query;

    if (!driverId) {
      return next(createError('Driver not found', 404));
    }

    let query = supabase
      .from('rides')
      .select(`
        *,
        client:users!rides_client_id_fkey(*),
        driver:drivers(*, user:users(*))
      `)
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const offset = (Number(page) - 1) * Number(limit);
    query = query.range(offset, offset + Number(limit) - 1);

    const { data: rides, error } = await query;

    if (error) {
      return next(createError('Failed to fetch rides', 500));
    }

    res.json({
      success: true,
      data: rides
    });

  } catch (error) {
    console.error('Get driver rides error:', error);
    next(createError('Failed to fetch rides', 500));
  }
};

export const assignDriverToRide = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rideId, driverId } = req.params;

    // Get ride details
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select('*')
      .eq('id', rideId)
      .eq('status', RideStatus.PENDING)
      .single();

    if (rideError || !ride) {
      return next(createError('Ride not found or already assigned', 404));
    }

    // Check if driver is available
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', driverId)
      .eq('state', DriverState.ONLINE)
      .single();

    if (driverError || !driver) {
      return next(createError('Driver not available', 404));
    }

    // Update ride and driver in transaction
    const { data: updatedRide, error: updateError } = await supabase
      .from('rides')
      .update({
        driver_id: driverId,
        status: RideStatus.ASSIGNED,
        updated_at: new Date().toISOString()
      })
      .eq('id', rideId)
      .select(`
        *,
        client:users!rides_client_id_fkey(*),
        driver:drivers(*, user:users(*))
      `)
      .single();

    if (updateError) {
      return next(createError('Failed to assign driver', 500));
    }

    // Update driver state
    await supabase
      .from('drivers')
      .update({
        state: DriverState.TO_PICKUP,
        updated_at: new Date().toISOString()
      })
      .eq('id', driverId);

    res.json({
      success: true,
      data: updatedRide,
      message: 'Driver assigned successfully'
    });

  } catch (error) {
    console.error('Assign driver error:', error);
    next(createError('Failed to assign driver', 500));
  }
};

export const findNearestDriver = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rideId } = req.params;

    // Get ride details
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select('*')
      .eq('id', rideId)
      .eq('status', RideStatus.PENDING)
      .single();

    if (rideError || !ride) {
      return next(createError('Ride not found', 404));
    }

    // Get available drivers
    const { data: drivers, error: driversError } = await supabase
      .from('drivers')
      .select(`
        *,
        user:users(*)
      `)
      .eq('state', DriverState.ONLINE);

    if (driversError) {
      return next(createError('Failed to fetch drivers', 500));
    }

    if (drivers.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'No available drivers'
      });
    }

    // Find nearest driver
    const driversWithDistance = drivers.map(driver => ({
      ...driver,
      distance: getDistance(
        ride.pickup_lat,
        ride.pickup_lng,
        driver.location_lat,
        driver.location_lng
      )
    }));

    const nearestDriver = driversWithDistance.reduce((prev, current) => 
      prev.distance < current.distance ? prev : current
    );

    // Auto-assign nearest driver if within 10km
    if (nearestDriver.distance <= 10) {
      // Update ride and driver
      const { data: updatedRide, error: updateError } = await supabase
        .from('rides')
        .update({
          driver_id: nearestDriver.id,
          status: RideStatus.ASSIGNED,
          updated_at: new Date().toISOString()
        })
        .eq('id', rideId)
        .select(`
          *,
          client:users!rides_client_id_fkey(*),
          driver:drivers(*, user:users(*))
        `)
        .single();

      if (updateError) {
        return next(createError('Failed to assign driver', 500));
      }

      // Update driver state
      await supabase
        .from('drivers')
        .update({
          state: DriverState.TO_PICKUP,
          updated_at: new Date().toISOString()
        })
        .eq('id', nearestDriver.id);

      res.json({
        success: true,
        data: updatedRide,
        message: 'Driver found and assigned'
      });
    } else {
      res.json({
        success: true,
        data: null,
        message: 'No drivers available nearby'
      });
    }

  } catch (error) {
    console.error('Find nearest driver error:', error);
    next(createError('Failed to find driver', 500));
  }
};

export const updateRideStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = Object.values(RideStatus);
    if (!validStatuses.includes(status)) {
      return next(createError('Invalid status', 400));
    }

    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    // Add timestamp for specific statuses
    if (status === RideStatus.IN_PROGRESS) {
      updateData.started_at = new Date().toISOString();
    } else if (status === RideStatus.COMPLETED) {
      updateData.completed_at = new Date().toISOString();
    } else if (status === RideStatus.CANCELLED) {
      updateData.cancelled_at = new Date().toISOString();
    }

    const { data: updatedRide, error } = await supabase
      .from('rides')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        client:users!rides_client_id_fkey(*),
        driver:drivers(*, user:users(*))
      `)
      .single();

    if (error) {
      return next(createError('Failed to update ride status', 500));
    }

    // Update driver state based on ride status
    if (updatedRide.driver_id) {
      let driverState: DriverState;
      
      switch (status) {
        case RideStatus.IN_PROGRESS:
          driverState = DriverState.TRIP_IN_PROGRESS;
          break;
        case RideStatus.COMPLETED:
        case RideStatus.CANCELLED:
          driverState = DriverState.ONLINE;
          break;
        default:
          driverState = DriverState.TO_PICKUP;
      }

      await supabase
        .from('drivers')
        .update({
          state: driverState,
          updated_at: new Date().toISOString()
        })
        .eq('id', updatedRide.driver_id);

      // Update earnings if ride is completed
      if (status === RideStatus.COMPLETED) {
        const { data: driver } = await supabase
          .from('drivers')
          .select('earnings_today')
          .eq('id', updatedRide.driver_id)
          .single();

        if (driver) {
          await supabase
            .from('drivers')
            .update({
              earnings_today: driver.earnings_today + updatedRide.fare
            })
            .eq('id', updatedRide.driver_id);
        }
      }
    }

    res.json({
      success: true,
      data: updatedRide,
      message: 'Ride status updated successfully'
    });

  } catch (error) {
    console.error('Update ride status error:', error);
    next(createError('Failed to update ride status', 500));
  }
};

export const cancelRide = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return next(createError('User not authenticated', 401));
    }

    // Get ride details
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select('*')
      .eq('id', id)
      .single();

    if (rideError || !ride) {
      return next(createError('Ride not found', 404));
    }

    // Check permissions
    if (ride.client_id !== userId && req.user?.role !== UserMode.ADMIN) {
      return next(createError('Not authorized to cancel this ride', 403));
    }

    // Update ride status
    const { data: updatedRide, error: updateError } = await supabase
      .from('rides')
      .update({
        status: RideStatus.CANCELLED,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        client:users!rides_client_id_fkey(*),
        driver:drivers(*, user:users(*))
      `)
      .single();

    if (updateError) {
      return next(createError('Failed to cancel ride', 500));
    }

    // Free up driver if assigned
    if (ride.driver_id) {
      await supabase
        .from('drivers')
        .update({
          state: DriverState.ONLINE,
          updated_at: new Date().toISOString()
        })
        .eq('id', ride.driver_id);
    }

    res.json({
      success: true,
      data: updatedRide,
      message: 'Ride cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel ride error:', error);
    next(createError('Failed to cancel ride', 500));
  }
};