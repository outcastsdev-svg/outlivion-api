// @ts-nocheck
import { Router } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { 
  verifyTelegramAuth, 
  extractTelegramUser, 
  validateTelegramAuthData,
  parseTelegramInitData,
  verifyTelegramInitData 
} from '../utils/telegram-auth';
import { createTokenPair } from '../utils/jwt';
import { validateBody, telegramAuthSchema, TelegramAuthInput } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import logger, { logAuth } from '../utils/logger';

const router = Router();

/**
 * POST /auth/telegram
 * Авторизация через Telegram Login Widget
 */
router.post('/telegram', asyncHandler(async (req, res) => {
  const { initData, referralId, ...widgetData } = req.body;

  // Check bot token configuration
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    logger.error('Telegram bot token not configured');
    return res.status(500).json({ 
      error: 'Server configuration error',
      code: 'CONFIG_ERROR',
    });
  }

  let telegramData;
  let authSource: 'widget' | 'miniapp' = 'widget';

  // Check if request is from bot (special marker)
  const isBotRequest = widgetData.hash === 'bot-created-user';
  
  // Determine auth type and validate
  if (initData && typeof initData === 'string') {
    // Telegram Mini App: initData string
    authSource = 'miniapp';
    
    // Parse initData
    telegramData = parseTelegramInitData(initData);
    
    if (!telegramData) {
      logAuth('Failed to parse initData', { authSource });
      return res.status(400).json({ 
        error: 'Invalid initData format',
        code: 'INVALID_INITDATA',
      });
    }
    
    // Verify initData signature
    const isValid = verifyTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN);
    
    if (!isValid) {
      logAuth('Invalid initData signature', { 
        telegramId: telegramData.id,
        authSource,
      });
      return res.status(401).json({ 
        error: 'Invalid Telegram authentication data',
        code: 'INVALID_SIGNATURE',
      });
    }
    
    logAuth('Mini App auth validated', { telegramId: telegramData.id });
  } else if (isBotRequest) {
    // Telegram Bot: special marker for bot-created users
    authSource = 'widget'; // Keep as widget for compatibility
    telegramData = widgetData as any;
    
    logAuth('Bot user creation request', { 
      telegramId: widgetData.id,
      firstName: widgetData.first_name,
    });
    
    // Skip signature validation for bot requests
    // Bot creates users with minimal data and special marker
  } else {
    // Telegram Login Widget: widget data object
    telegramData = widgetData as any;
    
    // Validate Widget data structure
    if (!validateTelegramAuthData(telegramData)) {
      logAuth('Invalid auth data structure', { telegramId: 'unknown', authSource });
      return res.status(400).json({ 
        error: 'Invalid authentication data format',
        code: 'INVALID_FORMAT',
      });
    }

    // Verify Widget signature
    const isValid = verifyTelegramAuth(telegramData, process.env.TELEGRAM_BOT_TOKEN);
    
    if (!isValid) {
      logAuth('Invalid Telegram signature', { 
        telegramId: telegramData.id,
        authDate: telegramData.auth_date,
        authSource,
      });
      return res.status(401).json({ 
        error: 'Invalid Telegram authentication data',
        code: 'INVALID_SIGNATURE',
      });
    }
    
    logAuth('Widget auth validated', { telegramId: telegramData.id });
  }

  // Extract user data
  const telegramUser = extractTelegramUser(telegramData);

  // Find existing user
  const existingUser = await db.query.users.findFirst({
    where: eq(users.telegramId, telegramUser.telegramId),
  });

  let isNewUser = false;
  let userId: string;
  let userTelegramId: string;
  let userUsername: string | null = null;
  let userFirstName: string | null = null;
  let userLastName: string | null = null;
  let userPhotoUrl: string | null = null;

  if (!existingUser) {
    isNewUser = true;
    
    // Find referrer if referralId provided
    let referrerId: string | null = null;
    if (referralId) {
      const referrer = await db.query.users.findFirst({
        where: eq(users.telegramId, referralId),
      });
      referrerId = referrer?.id || null;
      
      if (referrerId) {
        logAuth('User registered via referral', {
          newUserId: telegramUser.telegramId,
          referrerId: referralId,
        });
      }
    }

    // Create new user
    const insertResult = await db.insert(users).values({
      telegramId: telegramUser.telegramId,
      username: telegramUser.username,
      firstName: telegramUser.firstName,
      lastName: telegramUser.lastName,
      photoUrl: telegramUser.photoUrl,
      referredBy: referrerId,
    }).returning();

    const newUser = Array.isArray(insertResult) ? insertResult[0] : insertResult;
    
    if (!newUser) {
      logger.error('Failed to create user');
      return res.status(500).json({
        error: 'Failed to create user',
        code: 'USER_CREATE_ERROR',
      });
    }

    userId = newUser.id;
    userTelegramId = newUser.telegramId;
    userUsername = newUser.username;
    userFirstName = newUser.firstName;
    userLastName = newUser.lastName;
    userPhotoUrl = newUser.photoUrl;
    
    logAuth('New user created', {
      userId,
      telegramId: userTelegramId,
      username: userUsername,
    });
  } else {
    // Update existing user data
    const updateResult = await db.update(users)
      .set({
        username: telegramUser.username,
        firstName: telegramUser.firstName,
        lastName: telegramUser.lastName,
        photoUrl: telegramUser.photoUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingUser.id))
      .returning();

    const updatedUser = Array.isArray(updateResult) ? updateResult[0] : updateResult;
    const finalUser = updatedUser || existingUser;
    
    userId = finalUser.id;
    userTelegramId = finalUser.telegramId;
    userUsername = finalUser.username;
    userFirstName = finalUser.firstName;
    userLastName = finalUser.lastName;
    userPhotoUrl = finalUser.photoUrl;
    
    logAuth('User logged in', {
      userId,
      telegramId: userTelegramId,
    });
  }

  // Create token pair (access + refresh)
  const tokens = createTokenPair({
    userId,
    telegramId: userTelegramId,
  });

  res.json({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
    // Legacy support - also return as 'token'
    token: tokens.accessToken,
    user: {
      id: userId,
      telegramId: userTelegramId,
      username: userUsername,
      firstName: userFirstName,
      lastName: userLastName,
      photoUrl: userPhotoUrl,
      isNewUser,
    },
  });
}));

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken, telegramId } = req.body;

  if (!refreshToken || !telegramId) {
    return res.status(400).json({
      error: 'Refresh token and telegramId are required',
      code: 'MISSING_PARAMS',
    });
  }

  try {
    const { refreshAccessToken } = await import('../utils/jwt');
    const tokens = refreshAccessToken(refreshToken, telegramId);

    logAuth('Token refreshed', { telegramId });

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      // Legacy support
      token: tokens.accessToken,
    });
  } catch (error: unknown) {
    const err = error as Error;
    logAuth('Token refresh failed', { telegramId, error: err.message });
    return res.status(401).json({
      error: err.message,
      code: 'REFRESH_FAILED',
    });
  }
}));

export default router;
