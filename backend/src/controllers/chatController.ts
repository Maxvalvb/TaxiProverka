import { Request, Response, NextFunction } from 'express';
import supabase from '../services/supabase';
import { createError } from '../middleware/errorHandler';
import { AuthenticatedRequest, SendMessageRequest } from '../types';

export const sendMessage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { ride_id, message }: SendMessageRequest = req.body;

    if (!userId) {
      return next(createError('User not authenticated', 401));
    }

    // Verify user is part of the ride
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select(`
        *,
        driver:drivers!rides_driver_id_fkey(user_id)
      `)
      .eq('id', ride_id)
      .single();

    if (rideError || !ride) {
      return next(createError('Ride not found', 404));
    }

    // Check if user is client or driver of this ride
    const isClient = ride.client_id === userId;
    const isDriver = ride.driver?.user_id === userId;

    if (!isClient && !isDriver) {
      return next(createError('Not authorized to send messages in this ride', 403));
    }

    const messageData = {
      ride_id,
      sender_id: userId,
      sender_type: isClient ? 'client' as const : 'driver' as const,
      message
    };

    const { data: newMessage, error } = await supabase
      .from('chat_messages')
      .insert(messageData)
      .select(`
        *,
        sender:users(*)
      `)
      .single();

    if (error) {
      return next(createError('Failed to send message', 500));
    }

    res.status(201).json({
      success: true,
      data: newMessage,
      message: 'Message sent successfully'
    });

  } catch (error) {
    console.error('Send message error:', error);
    next(createError('Failed to send message', 500));
  }
};

export const getRideMessages = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { rideId } = req.params;

    if (!userId) {
      return next(createError('User not authenticated', 401));
    }

    // Verify user is part of the ride
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select(`
        *,
        driver:drivers!rides_driver_id_fkey(user_id)
      `)
      .eq('id', rideId)
      .single();

    if (rideError || !ride) {
      return next(createError('Ride not found', 404));
    }

    // Check if user is client or driver of this ride
    const isClient = ride.client_id === userId;
    const isDriver = ride.driver?.user_id === userId;

    if (!isClient && !isDriver) {
      return next(createError('Not authorized to view messages in this ride', 403));
    }

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select(`
        *,
        sender:users(*)
      `)
      .eq('ride_id', rideId)
      .order('created_at', { ascending: true });

    if (error) {
      return next(createError('Failed to fetch messages', 500));
    }

    res.json({
      success: true,
      data: messages
    });

  } catch (error) {
    console.error('Get ride messages error:', error);
    next(createError('Failed to fetch messages', 500));
  }
};