import { Request, Response, NextFunction } from 'express';
import { isValidEmail, isValidPhone, formatPhone } from '../utils/helpers';
import { createError } from './errorHandler';

export const validateLoginData = (req: Request, res: Response, next: NextFunction) => {
  const { phone, role } = req.body;

  if (!phone) {
    return next(createError('Phone is required', 400));
  }

  if (!role) {
    return next(createError('Role is required', 400));
  }

  if (!['CLIENT', 'DRIVER', 'ADMIN'].includes(role)) {
    return next(createError('Invalid role', 400));
  }

  const formattedPhone = formatPhone(phone);
  if (!isValidPhone(formattedPhone)) {
    return next(createError('Invalid phone format', 400));
  }

  req.body.phone = formattedPhone;
  next();
};

export const validateRegisterData = (req: Request, res: Response, next: NextFunction) => {
  const { phone, email, name, role } = req.body;

  if (!phone || !email || !name || !role) {
    return next(createError('Phone, email, name, and role are required', 400));
  }

  if (!isValidEmail(email)) {
    return next(createError('Invalid email format', 400));
  }

  const formattedPhone = formatPhone(phone);
  if (!isValidPhone(formattedPhone)) {
    return next(createError('Invalid phone format', 400));
  }

  if (!['CLIENT', 'DRIVER', 'ADMIN'].includes(role)) {
    return next(createError('Invalid role', 400));
  }

  req.body.phone = formattedPhone;
  next();
};

export const validateRideData = (req: Request, res: Response, next: NextFunction) => {
  const { 
    pickup_address, 
    destination_address, 
    pickup_lat, 
    pickup_lng, 
    destination_lat, 
    destination_lng,
    fare,
    ride_type 
  } = req.body;

  if (!pickup_address || !destination_address) {
    return next(createError('Pickup and destination addresses are required', 400));
  }

  if (typeof pickup_lat !== 'number' || typeof pickup_lng !== 'number' ||
      typeof destination_lat !== 'number' || typeof destination_lng !== 'number') {
    return next(createError('Invalid coordinates', 400));
  }

  if (typeof fare !== 'number' || fare <= 0) {
    return next(createError('Invalid fare amount', 400));
  }

  if (!['Эконом', 'Комфорт', 'Бизнес'].includes(ride_type)) {
    return next(createError('Invalid ride type', 400));
  }

  next();
};

export const validateDriverData = (req: Request, res: Response, next: NextFunction) => {
  const { car_model, license_plate } = req.body;

  if (!car_model || !license_plate) {
    return next(createError('Car model and license plate are required', 400));
  }

  next();
};

export const validateLocationData = (req: Request, res: Response, next: NextFunction) => {
  const { lat, lng } = req.body;

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return next(createError('Valid latitude and longitude are required', 400));
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return next(createError('Invalid coordinates range', 400));
  }

  next();
};