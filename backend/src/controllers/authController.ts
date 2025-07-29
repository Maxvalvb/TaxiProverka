import { Request, Response, NextFunction } from 'express';
import supabase from '../services/supabase';
import { generateToken } from '../utils/helpers';
import { createError } from '../middleware/errorHandler';
import { LoginRequest, LoginResponse, UserMode } from '../types';

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, role }: LoginRequest = req.body;

    // Find user by phone and role
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .eq('role', role)
      .single();

    // If user doesn't exist, create new user (simplified auth)
    let userData = user;
    if (userError && userError.code === 'PGRST116') {
      // User not found, create new user
      const newUser = {
        phone,
        email: `${phone.replace('+', '')}@temp.com`, // Temporary email
        name: role === UserMode.CLIENT ? 'Клиент' : 
              role === UserMode.DRIVER ? 'Водитель' : 'Администратор',
        role,
        wallet_balance: role === UserMode.CLIENT ? 1000 : 0,
        photo_url: role === UserMode.CLIENT ? 'https://i.pravatar.cc/150?u=user1' :
                   role === UserMode.DRIVER ? 'https://i.pravatar.cc/150?u=driver1' :
                   'https://i.pravatar.cc/150?u=admin1',
        location_lat: 55.755,
        location_lng: 37.617
      };

      const { data: createdUser, error: createError } = await supabase
        .from('users')
        .insert(newUser)
        .select()
        .single();

      if (createError) {
        return next(createError('Failed to create user', 500));
      }

      userData = createdUser;

      // If driver, create driver record
      if (role === UserMode.DRIVER) {
        const driverData = {
          user_id: userData.id,
          car_model: 'Toyota Camry',
          license_plate: 'А000АА777',
          rating: 5.0,
          earnings_today: 0,
          state: 'OFFLINE',
          location_lat: 55.755,
          location_lng: 37.617
        };

        const { error: driverError } = await supabase
          .from('drivers')
          .insert(driverData);

        if (driverError) {
          console.error('Failed to create driver record:', driverError);
        }
      }
    } else if (userError) {
      return next(createError('Database error', 500));
    }

    // Generate JWT token
    const token = generateToken(userData);

    // Prepare response
    const response: LoginResponse = {
      user: userData,
      token
    };

    // If user is a driver, include driver data
    if (userData.role === UserMode.DRIVER) {
      const { data: driver } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', userData.id)
        .single();

      if (driver) {
        response.driver = driver;
      }
    }

    res.json({
      success: true,
      data: response,
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Login error:', error);
    next(createError('Login failed', 500));
  }
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, email, name, role } = req.body;

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('phone', phone)
      .single();

    if (existingUser) {
      return next(createError('User with this phone already exists', 409));
    }

    // Create new user
    const newUser = {
      phone,
      email,
      name,
      role,
      wallet_balance: role === UserMode.CLIENT ? 1000 : 0,
      photo_url: `https://i.pravatar.cc/150?u=${Date.now()}`,
      location_lat: 55.755 + (Math.random() - 0.5) * 0.1,
      location_lng: 37.617 + (Math.random() - 0.5) * 0.1
    };

    const { data: createdUser, error: createError } = await supabase
      .from('users')
      .insert(newUser)
      .select()
      .single();

    if (createError) {
      return next(createError('Failed to create user', 500));
    }

    // If driver, create driver record
    if (role === UserMode.DRIVER) {
      const driverData = {
        user_id: createdUser.id,
        car_model: 'Toyota Camry',
        license_plate: `А${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}АА777`,
        rating: 5.0,
        earnings_today: 0,
        state: 'OFFLINE',
        location_lat: newUser.location_lat,
        location_lng: newUser.location_lng
      };

      await supabase
        .from('drivers')
        .insert(driverData);
    }

    // Generate JWT token
    const token = generateToken(createdUser);

    res.status(201).json({
      success: true,
      data: {
        user: createdUser,
        token
      },
      message: 'User registered successfully'
    });

  } catch (error) {
    console.error('Register error:', error);
    next(createError('Registration failed', 500));
  }
};

export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(createError('Failed to get profile', 500));
  }
};