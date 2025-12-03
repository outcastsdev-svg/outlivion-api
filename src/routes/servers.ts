// @ts-nocheck
import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { servers, configs, users } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { authMiddleware } from '../utils/jwt';
import { getMarzbanService } from '../services/marzban';
import { requireActiveSubscription } from '../middleware/subscription';
import { validateParams, serverIdParamSchema } from '../middleware/validation';
import { asyncHandler, NotFoundError } from '../middleware/errorHandler';
import logger from '../utils/logger';

const router = Router();

// Extended request type with user and subscription
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
 * GET /servers
 * Get list of all available servers
 */
router.get('/', asyncHandler(async (req, res) => {
  const allServers = await db.query.servers.findMany({
    where: eq(servers.isActive, true),
  });

  res.json(allServers.map(server => ({
    id: server.id,
    name: server.name,
    location: server.location,
    country: server.country,
    load: server.load,
    maxUsers: server.maxUsers,
    currentUsers: server.currentUsers,
    isActive: server.isActive,
  })));
}));

/**
 * GET /servers/:serverId/config
 * Get or create configuration for a server
 */
router.get(
  '/:serverId/config',
  authMiddleware,
  validateParams(serverIdParamSchema),
  requireActiveSubscription as any,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.userId;
    const { serverId } = req.params;
    const subscription = authReq.subscription;

    if (!subscription) {
      throw NotFoundError('Active subscription required', 'NO_SUBSCRIPTION');
    }

    // Check if server exists and is active
    const server = await db.query.servers.findFirst({
      where: and(
        eq(servers.id, serverId),
        eq(servers.isActive, true)
      ),
    });

    if (!server) {
      throw NotFoundError('Server not found or inactive', 'SERVER_NOT_FOUND');
    }

    // Check for existing config for this server
    let config = await db.query.configs.findFirst({
      where: and(
        eq(configs.userId, userId),
        eq(configs.serverId, serverId)
      ),
      with: {
        server: true,
      },
    });

    if (!config) {
      // Get user data
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        throw NotFoundError('User not found', 'USER_NOT_FOUND');
      }

      logger.info('Creating new server config', {
        userId,
        serverId,
        serverName: server.name,
      });

      // Get Marzban service (async)
      const marzbanService = await getMarzbanService();
      const marzbanUsername = `user_${user.telegramId}`;

      // Get or create Marzban user
      const expireDate = subscription.endDate.getTime();
      await marzbanService.getOrCreateUser(marzbanUsername, 0, expireDate);

      // Get VLESS configuration
      const vlessConfig = await marzbanService.getVlessConfig(
        marzbanUsername,
        server.host,
        server.port
      );

      // Generate QR code
      const qrCode = await marzbanService.generateQRCode(vlessConfig);

      // Save config to database
      const [newConfig] = await db.insert(configs).values({
        userId,
        serverId,
        marzbanUserId: marzbanUsername,
        vlessConfig,
        qrCode,
        isActive: true,
      }).returning();

      config = {
        ...newConfig,
        server,
      };

      logger.info('Server config created', {
        configId: config.id,
        userId,
        serverId,
      });
    }

    // Get server info safely
    const serverInfo = config.server && !Array.isArray(config.server) ? config.server : null;

    res.json({
      id: config.id,
      serverId: config.serverId,
      serverName: serverInfo?.name,
      serverLocation: serverInfo?.location,
      serverCountry: serverInfo?.country,
      vlessConfig: config.vlessConfig,
      qrCode: config.qrCode,
      isActive: config.isActive,
    });
  })
);

/**
 * DELETE /servers/:serverId/config
 * Delete configuration for a server
 */
router.delete(
  '/:serverId/config',
  authMiddleware,
  validateParams(serverIdParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.userId;
    const { serverId } = req.params;

    const config = await db.query.configs.findFirst({
      where: and(
        eq(configs.userId, userId),
        eq(configs.serverId, serverId)
      ),
    });

    if (!config) {
      throw NotFoundError('Config not found', 'CONFIG_NOT_FOUND');
    }

    await db.delete(configs)
      .where(eq(configs.id, config.id));

    logger.info('Server config deleted', {
      configId: config.id,
      userId,
      serverId,
    });

    res.json({ success: true, message: 'Config deleted' });
  })
);

export default router;
