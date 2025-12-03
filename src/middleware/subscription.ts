// @ts-nocheck
import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { subscriptions } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { ForbiddenError } from './errorHandler';
import logger from '../utils/logger';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    telegramId: string;
  };
  subscription?: {
    id: string;
    plan: string;
    status: string;
    endDate: Date;
    daysRemaining: number;
  };
}

/**
 * Middleware to require an active subscription
 * Attaches subscription info to request if valid
 */
export async function requireActiveSubscription(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      throw ForbiddenError('Authentication required', 'AUTH_REQUIRED');
    }

    // Get latest subscription
    const subscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId),
      orderBy: [desc(subscriptions.createdAt)],
    });

    if (!subscription) {
      logger.debug('No subscription found', { userId });
      throw ForbiddenError('Active subscription required', 'NO_SUBSCRIPTION');
    }

    if (subscription.status !== 'active') {
      logger.debug('Subscription not active', { 
        userId, 
        status: subscription.status,
      });
      throw ForbiddenError('Active subscription required', 'SUBSCRIPTION_INACTIVE');
    }

    const now = new Date();
    const endDate = new Date(subscription.endDate);

    if (endDate < now) {
      logger.debug('Subscription expired', { 
        userId, 
        endDate: subscription.endDate,
      });
      throw ForbiddenError('Subscription expired', 'SUBSCRIPTION_EXPIRED');
    }

    // Calculate days remaining
    const daysRemaining = Math.ceil(
      (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Attach subscription info to request
    req.subscription = {
      id: subscription.id,
      plan: subscription.plan,
      status: subscription.status,
      endDate,
      daysRemaining,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to optionally attach subscription info
 * Does not block request if no subscription
 */
export async function attachSubscription(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return next();
    }

    const subscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId),
      orderBy: [desc(subscriptions.createdAt)],
    });

    if (subscription) {
      const now = new Date();
      const endDate = new Date(subscription.endDate);
      const daysRemaining = Math.max(0, Math.ceil(
        (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      ));

      req.subscription = {
        id: subscription.id,
        plan: subscription.plan,
        status: endDate < now ? 'expired' : subscription.status,
        endDate,
        daysRemaining,
      };
    }

    next();
  } catch (error) {
    // Don't fail the request, just log and continue
    logger.error('Failed to attach subscription', { 
      error: (error as Error).message,
    });
    next();
  }
}

