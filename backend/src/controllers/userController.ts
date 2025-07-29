import { Request, Response, NextFunction } from 'express';
import supabase from '../services/supabase';
import { createError } from '../middleware/errorHandler';
import { AuthenticatedRequest, UpdateProfileRequest, AddPaymentCardRequest } from '../types';

export const updateProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { name, email, photo_url }: UpdateProfileRequest = req.body;

    if (!userId) {
      return next(createError('User not authenticated', 401));
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (photo_url) updateData.photo_url = photo_url;

    if (Object.keys(updateData).length === 0) {
      return next(createError('No data to update', 400));
    }

    updateData.updated_at = new Date().toISOString();

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return next(createError('Failed to update profile', 500));
    }

    res.json({
      success: true,
      data: updatedUser,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Update profile error:', error);
    next(createError('Failed to update profile', 500));
  }
};

export const getPaymentCards = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return next(createError('User not authenticated', 401));
    }

    const { data: cards, error } = await supabase
      .from('payment_cards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return next(createError('Failed to fetch payment cards', 500));
    }

    res.json({
      success: true,
      data: cards
    });

  } catch (error) {
    console.error('Get payment cards error:', error);
    next(createError('Failed to fetch payment cards', 500));
  }
};

export const addPaymentCard = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { last4, brand }: AddPaymentCardRequest = req.body;

    if (!userId) {
      return next(createError('User not authenticated', 401));
    }

    const cardData = {
      user_id: userId,
      last4,
      brand
    };

    const { data: newCard, error } = await supabase
      .from('payment_cards')
      .insert(cardData)
      .select()
      .single();

    if (error) {
      return next(createError('Failed to add payment card', 500));
    }

    res.status(201).json({
      success: true,
      data: newCard,
      message: 'Payment card added successfully'
    });

  } catch (error) {
    console.error('Add payment card error:', error);
    next(createError('Failed to add payment card', 500));
  }
};

export const deletePaymentCard = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return next(createError('User not authenticated', 401));
    }

    const { error } = await supabase
      .from('payment_cards')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      return next(createError('Failed to delete payment card', 500));
    }

    res.json({
      success: true,
      message: 'Payment card deleted successfully'
    });

  } catch (error) {
    console.error('Delete payment card error:', error);
    next(createError('Failed to delete payment card', 500));
  }
};

export const updateWalletBalance = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { amount } = req.body;

    if (!userId) {
      return next(createError('User not authenticated', 401));
    }

    if (typeof amount !== 'number') {
      return next(createError('Invalid amount', 400));
    }

    // Get current balance
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('wallet_balance')
      .eq('id', userId)
      .single();

    if (fetchError) {
      return next(createError('User not found', 404));
    }

    const newBalance = user.wallet_balance + amount;

    if (newBalance < 0) {
      return next(createError('Insufficient funds', 400));
    }

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({
        wallet_balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return next(createError('Failed to update wallet balance', 500));
    }

    res.json({
      success: true,
      data: updatedUser,
      message: 'Wallet balance updated successfully'
    });

  } catch (error) {
    console.error('Update wallet balance error:', error);
    next(createError('Failed to update wallet balance', 500));
  }
};