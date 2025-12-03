// @ts-nocheck
import cron from 'node-cron';
import { db } from '../db';
import { subscriptions, users } from '../db/schema';
import { eq, and, lt, sql } from 'drizzle-orm';
import { getMarzbanService } from '../services/marzban';
import logger from '../utils/logger';

// Batch size for processing expired subscriptions
const BATCH_SIZE = 100;

// Delay between Marzban API calls (ms)
const API_DELAY = 100;

/**
 * Process a single expired subscription
 */
async function processExpiredSubscription(subscription: {
  id: string;
  userId: string;
}): Promise<boolean> {
  try {
    // Update subscription status
    await db.update(subscriptions)
      .set({
        status: 'expired',
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id));

    // Get user's Telegram ID for Marzban
    const user = await db.query.users.findFirst({
      where: eq(users.id, subscription.userId),
    });

    if (user) {
      // Deactivate user in Marzban
      try {
        const marzbanService = await getMarzbanService();
        const marzbanUsername = `user_${user.telegramId}`;
        
        await marzbanService.updateUser(marzbanUsername, {
          status: 'disabled',
        });
        
        logger.info('Marzban user deactivated', {
          subscriptionId: subscription.id,
          userId: subscription.userId,
          marzbanUsername,
        });
      } catch (error: any) {
        logger.error('Failed to deactivate Marzban user', {
          subscriptionId: subscription.id,
          userId: subscription.userId,
          error: error.message,
        });
      }
    }

    return true;
  } catch (error: any) {
    logger.error('Failed to process expired subscription', {
      subscriptionId: subscription.id,
      error: error.message,
    });
    return false;
  }
}

/**
 * Check and update expired subscriptions
 * Uses efficient SQL filtering and batch processing
 */
async function checkExpiredSubscriptions(): Promise<void> {
  const startTime = Date.now();
  logger.info('Starting subscription expiration check');

  try {
    const now = new Date();
    let processedCount = 0;
    let failedCount = 0;
    let hasMore = true;

    while (hasMore) {
      // Fetch batch of expired subscriptions using SQL filter
      // This is much more efficient than loading all and filtering in JS
      const expiredBatch = await db
        .select({
          id: subscriptions.id,
          userId: subscriptions.userId,
        })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.status, 'active'),
            lt(subscriptions.endDate, now)
          )
        )
        .limit(BATCH_SIZE);

      if (expiredBatch.length === 0) {
        hasMore = false;
        break;
      }

      // Process each subscription
      for (const subscription of expiredBatch) {
        const success = await processExpiredSubscription(subscription);
        
        if (success) {
          processedCount++;
        } else {
          failedCount++;
        }

        // Small delay to avoid overwhelming Marzban API
        if (API_DELAY > 0) {
          await new Promise(resolve => setTimeout(resolve, API_DELAY));
        }
      }

      // If we got less than batch size, no more records
      if (expiredBatch.length < BATCH_SIZE) {
        hasMore = false;
      }
    }

    const duration = Date.now() - startTime;
    
    logger.info('Subscription expiration check completed', {
      processed: processedCount,
      failed: failedCount,
      durationMs: duration,
    });
  } catch (error: any) {
    logger.error('Subscription expiration check failed', {
      error: error.message,
      stack: error.stack,
    });
  }
}

/**
 * Send expiration warnings (24 hours before expiry)
 */
async function sendExpirationWarnings(): Promise<void> {
  try {
    const now = new Date();
    const warningThreshold = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    // Find subscriptions expiring within 24 hours
    const expiringSubscriptions = await db
      .select({
        id: subscriptions.id,
        userId: subscriptions.userId,
        endDate: subscriptions.endDate,
      })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, 'active'),
          lt(subscriptions.endDate, warningThreshold),
          // Only those not yet expired
          sql`${subscriptions.endDate} > ${now}`
        )
      )
      .limit(100);

    for (const subscription of expiringSubscriptions) {
      // In the future, this could send Telegram notifications
      logger.info('Subscription expiring soon', {
        subscriptionId: subscription.id,
        userId: subscription.userId,
        endDate: subscription.endDate,
      });
    }

    if (expiringSubscriptions.length > 0) {
      logger.info('Expiration warnings sent', {
        count: expiringSubscriptions.length,
      });
    }
  } catch (error: any) {
    logger.error('Failed to send expiration warnings', {
      error: error.message,
    });
  }
}

/**
 * Start subscription checker cron jobs
 */
export function startSubscriptionChecker(): void {
  // Check expired subscriptions every hour
  cron.schedule('0 * * * *', async () => {
    await checkExpiredSubscriptions();
  });

  // Send expiration warnings every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    await sendExpirationWarnings();
  });

  logger.info('Subscription cron jobs initialized', {
    expirationCheck: 'every hour (0 * * * *)',
    warningCheck: 'every 6 hours (0 */6 * * *)',
  });

  // Run initial check after 10 seconds
  setTimeout(async () => {
    logger.info('Running initial subscription check');
    await checkExpiredSubscriptions();
  }, 10000);
}

// Export for testing
export { checkExpiredSubscriptions, sendExpirationWarnings };
