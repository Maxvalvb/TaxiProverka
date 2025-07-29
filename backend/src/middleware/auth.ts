import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/helpers';
import supabase from '../services/supabase';
import { AuthenticatedRequest, UserMode } from '../types';

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Access token required' 
      });
    }

    const decoded = verifyToken(token);
    
    // Fetch user from database
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token or user not found' 
      });
    }

    req.user = user;

    // If user is a driver, fetch driver data too
    if (user.role === UserMode.DRIVER) {
      const { data: driver } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      req.driver = driver;
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid token' 
    });
  }
};

export const requireRole = (roles: UserMode[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role as UserMode)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Insufficient permissions' 
      });
    }
    next();
  };
};