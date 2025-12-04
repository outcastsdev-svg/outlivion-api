/**
 * Telegram Bot Deep-Link Authentication Routes
 * Login via /start login_<TOKEN> flow
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { loginSessions, users } from '../db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { createToken, createTokenPair } from '../utils/jwt';
import logger from '../utils/logger';
import crypto from 'crypto';
import { 
  createTokenLimiter, 
  checkLoginLimiter, 
  confirmLoginLimiter,
  cleanupLimiter 
} from '../middleware/bot-auth-limiter';

const router = Router();

// Validation schemas
const createLoginTokenSchema = z.object({
  // Optional: can pass device info, IP, etc.
  deviceInfo: z.string().optional(),
});

const confirmLoginSchema = z.object({
  token: z.string().min(1),
  telegramId: z.string().min(1),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  photoUrl: z.string().optional(),
});

const checkLoginSchema = z.object({
  token: z.string().min(1),
});

/**
 * POST /auth/bot/create-login-token
 * Creates a new login session and returns bot deep-link URL
 */
router.post('/create-login-token', createTokenLimiter, async (req, res) => {
  try {
    const body = createLoginTokenSchema.parse(req.body);

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');

    // Set expiration (5 minutes from now)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Create login session
    await db.insert(loginSessions).values({
      token,
      status: 'pending',
      expiresAt,
    });

    // Get bot username from env
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'outlivionbot';

    // Generate bot deep-link URL
    const botUrl = `https://t.me/${botUsername}?start=login_${token}`;

    logger.info('Login token created', { token, expiresAt });

    res.json({
      token,
      botUrl,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error: any) {
    logger.error('Failed to create login token', { error: error.message });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }

    res.status(500).json({ error: 'Failed to create login token' });
  }
});

/**
 * POST /auth/bot/confirm-login
 * Called by Telegram bot when user clicks /start login_<TOKEN>
 */
router.post('/confirm-login', confirmLoginLimiter, async (req, res) => {
  try {
    const body = confirmLoginSchema.parse(req.body);
    const { token, telegramId, username, firstName, lastName, photoUrl } = body;

    logger.info('Login confirmation request', { token, telegramId });

    // Find login session
    const [session] = await db
      .select()
      .from(loginSessions)
      .where(and(
        eq(loginSessions.token, token),
        eq(loginSessions.status, 'pending')
      ))
      .limit(1);

    if (!session) {
      logger.warn('Login session not found or already used', { token });
      return res.status(404).json({ error: 'Login session not found or already used' });
    }

    // Check if expired
    if (new Date() > new Date(session.expiresAt)) {
      // Mark as expired
      await db
        .update(loginSessions)
        .set({ status: 'expired' })
        .where(eq(loginSessions.id, session.id));

      logger.warn('Login session expired', { token });
      return res.status(400).json({ error: 'Login session expired' });
    }

    // Find or create user
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.telegramId, telegramId))
      .limit(1);

    if (!user) {
      // Create new user
      const newUsers = await db
        .insert(users)
        .values({
          telegramId,
          username: username || null,
          firstName: firstName || null,
          lastName: lastName || null,
          photoUrl: photoUrl || null,
        })
        .returning();
      
      user = newUsers[0];

      logger.info('New user created via bot login', { userId: user.id, telegramId });
    } else {
      // Update existing user info
      const updatedUsers = await db
        .update(users)
        .set({
          username: username || user.username,
          firstName: firstName || user.firstName,
          lastName: lastName || user.lastName,
          photoUrl: photoUrl || user.photoUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
        .returning();
      
      user = updatedUsers[0];

      logger.info('Existing user updated via bot login', { userId: user.id, telegramId });
    }

    // Update login session
    await db
      .update(loginSessions)
      .set({
        status: 'approved',
        telegramId,
        userId: user.id,
      })
      .where(eq(loginSessions.id, session.id));

    logger.info('Login session approved', { token, userId: user.id });

    res.json({ 
      ok: true, 
      message: 'Login confirmed successfully',
    });
  } catch (error: any) {
    logger.error('Failed to confirm login', { error: error.message });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }

    res.status(500).json({ error: 'Failed to confirm login' });
  }
});

/**
 * GET /auth/bot/check-login?token=<TOKEN>
 * Frontend polls this endpoint to check login status
 * NOTE: This endpoint is called frequently (polling), so it has separate rate limiting
 */
router.get('/check-login', checkLoginLimiter, async (req, res) => {
  try {
    const { token } = checkLoginSchema.parse(req.query);

    // Find login session
    const [session] = await db
      .select()
      .from(loginSessions)
      .where(eq(loginSessions.token, token))
      .limit(1);

    if (!session) {
      return res.status(404).json({ 
        status: 'not_found',
        message: 'Login session not found',
      });
    }

    // Check if expired
    if (new Date() > new Date(session.expiresAt)) {
      // Mark as expired if not already
      if (session.status === 'pending') {
        await db
          .update(loginSessions)
          .set({ status: 'expired' })
          .where(eq(loginSessions.id, session.id));
      }

      return res.json({ 
        status: 'expired',
        message: 'Login session expired',
      });
    }

    // If still pending
    if (session.status === 'pending') {
      return res.json({ 
        status: 'pending',
        message: 'Waiting for confirmation in Telegram',
      });
    }

    // If approved, fetch user and generate tokens
    if (session.status === 'approved' && session.userId) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);

      if (!user) {
        return res.status(500).json({ error: 'User not found' });
      }

      // Generate JWT tokens
      const tokens = createTokenPair({
        userId: user.id,
        telegramId: user.telegramId,
      });

      logger.info('Login session checked - approved', { token, userId: user.id });

      return res.json({
        status: 'approved',
        message: 'Login confirmed successfully',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          telegramId: user.telegramId,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          photoUrl: user.photoUrl,
          balance: user.balance,
        },
      });
    }

    // Default response
    res.json({ 
      status: session.status,
      message: 'Unknown status',
    });
  } catch (error: any) {
    logger.error('Failed to check login', { error: error.message });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }

    res.status(500).json({ error: 'Failed to check login' });
  }
});

/**
 * DELETE /auth/bot/cleanup-expired
 * Cleanup expired login sessions (can be called by cron)
 */
router.delete('/cleanup-expired', cleanupLimiter, async (req, res) => {
  try {
    const result = await db
      .delete(loginSessions)
      .where(and(
        eq(loginSessions.status, 'pending'),
        gt(loginSessions.expiresAt, new Date())
      ));

    logger.info('Cleaned up expired login sessions', { count: result.rowCount });

    res.json({ 
      ok: true, 
      deleted: result.rowCount || 0,
    });
  } catch (error: any) {
    logger.error('Failed to cleanup expired sessions', { error: error.message });
    res.status(500).json({ error: 'Failed to cleanup expired sessions' });
  }
});

export default router;

