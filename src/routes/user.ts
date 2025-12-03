// @ts-nocheck
import { Router } from 'express';
import { db } from '../db';
import { users, subscriptions, configs, payments } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware } from '../utils/jwt';
import { asyncHandler } from '../middleware/errorHandler';
import logger from '../utils/logger';

const router = Router();

// Все маршруты требуют аутентификации
router.use(authMiddleware);

/**
 * GET /user
 * Получает информацию о текущем пользователе
 */
router.get('/', asyncHandler(async (req: any, res) => {
  const userId = req.user.userId;

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    id: user.id,
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    photoUrl: user.photoUrl,
    balance: user.balance || 0,
    createdAt: user.createdAt,
  });
}));

/**
 * GET /user/subscription
 * Получает текущую подписку пользователя
 * 
 * Поддерживает два режима:
 * 1. С авторизацией (через middleware) - для обычных запросов
 * 2. По telegramId (query param) - для запросов от бота (без авторизации)
 */
router.get('/subscription', asyncHandler(async (req: any, res) => {
  let userId: string | undefined;
  
  // Проверяем запрос от бота (query param telegramId)
  const telegramId = req.query.telegramId as string | undefined;
  
  if (telegramId) {
    // Запрос от бота - находим пользователя по Telegram ID
    logger.info('Bot subscription request', { telegramId });
    
    const user = await db.query.users.findFirst({
      where: eq(users.telegramId, telegramId),
    });
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }
    
    userId = user.id;
  } else {
    // Обычный запрос - требуется авторизация
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
    }
    
    userId = req.user.userId;
  }

  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
    orderBy: [desc(subscriptions.createdAt)],
  });

  if (!subscription) {
    return res.json({
      status: 'none',
      message: 'No active subscription',
    });
  }

  const now = new Date();
  const isExpired = new Date(subscription.endDate) < now;
  const status = isExpired ? 'expired' : subscription.status;

  res.json({
    id: subscription.id,
    plan: subscription.plan,
    status,
    startDate: subscription.startDate,
    endDate: subscription.endDate,
    autoRenew: subscription.autoRenew,
    isExpired,
    daysRemaining: isExpired 
      ? 0 
      : Math.ceil((new Date(subscription.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  });
}));

/**
 * GET /user/servers
 * Получает список серверов пользователя с конфигурациями
 */
router.get('/servers', asyncHandler(async (req: any, res) => {
  const userId = req.user.userId;

  const userConfigs = await db.query.configs.findMany({
    where: eq(configs.userId, userId),
    with: {
      server: true,
    },
  });

  res.json(userConfigs.map(config => {
    // Handle server relation - could be object or array due to drizzle relations
    const server = config.server && !Array.isArray(config.server) 
      ? config.server 
      : null;
    
    return {
      id: config.id,
      serverId: config.serverId,
      serverName: server?.name,
      serverLocation: server?.location,
      serverCountry: server?.country,
      isActive: config.isActive,
      createdAt: config.createdAt,
    };
  }));
}));

/**
 * GET /user/config/:serverId
 * Получает конфигурацию для конкретного сервера
 */
router.get('/config/:serverId', asyncHandler(async (req: any, res) => {
  const userId = req.user.userId;
  const { serverId } = req.params;

  const config = await db.query.configs.findFirst({
    where: eq(configs.userId, userId),
    with: {
      server: true,
    },
  });

  if (!config || config.serverId !== serverId) {
    return res.status(404).json({ error: 'Config not found' });
  }

  // Handle server relation
  const server = config.server && !Array.isArray(config.server) 
    ? config.server 
    : null;

  res.json({
    id: config.id,
    serverId: config.serverId,
    serverName: server?.name,
    serverLocation: server?.location,
    vlessConfig: config.vlessConfig,
    qrCode: config.qrCode,
    isActive: config.isActive,
  });
}));

/**
 * GET /user/payments
 * Получает историю платежей пользователя
 */
router.get('/payments', asyncHandler(async (req: any, res) => {
  const userId = req.user.userId;

  const userPayments = await db.query.payments.findMany({
    where: eq(payments.userId, userId),
    orderBy: [desc(payments.createdAt)],
    limit: 50,
  });

  res.json(userPayments.map(payment => ({
    id: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    plan: payment.plan,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  })));
}));

// REMOVED: /balance/add and /balance/deduct endpoints
// These were security vulnerabilities - balance should only be modified through:
// 1. Payment webhook (when user pays)
// 2. Referral system (automated bonus)
// 3. Admin panel (future implementation)

export default router;
