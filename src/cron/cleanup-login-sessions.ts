/**
 * Cron job for cleaning up expired login sessions
 * Runs every 10 minutes to remove old pending/expired sessions
 */

import cron from 'node-cron';
import { db } from '../db';
import { loginSessions } from '../db/schema';
import { and, lt, eq } from 'drizzle-orm';
import logger from '../utils/logger';

/**
 * Cleanup expired login sessions
 */
export async function cleanupExpiredSessions(): Promise<void> {
  try {
    const now = new Date();

    // Delete sessions that are:
    // 1. Still pending but expired
    // 2. Older than 1 hour (regardless of status)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const result = await db
      .delete(loginSessions)
      .where(
        and(
          lt(loginSessions.createdAt, oneHourAgo)
        )
      );

    if (result.rowCount && result.rowCount > 0) {
      logger.info('[Cron] Cleaned up expired login sessions', {
        deleted: result.rowCount,
      });
    }
  } catch (error: any) {
    logger.error('[Cron] Failed to cleanup login sessions', {
      error: error.message,
    });
  }
}

/**
 * Start cron job for cleanup
 * Runs every 10 minutes
 */
export function startLoginSessionsCleanup(): void {
  // Run every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    logger.info('[Cron] Running login sessions cleanup');
    await cleanupExpiredSessions();
  });

  logger.info('[Cron] Login sessions cleanup job scheduled (every 10 minutes)');
}

