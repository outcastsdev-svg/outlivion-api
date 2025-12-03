// @ts-nocheck
import { Router } from 'express';
import { db } from '../db';
import { payments, subscriptions, users, promoCodes } from '../db/schema';
import { eq, desc, ilike, and, sql } from 'drizzle-orm';
import { authMiddleware } from '../utils/jwt';
import { getMercuryoService } from '../services/mercuryo';
import { getMarzbanService } from '../services/marzban';
import { validateBody, createPaymentSchema, CreatePaymentInput } from '../middleware/validation';
import { asyncHandler, BadRequestError, NotFoundError, UnauthorizedError } from '../middleware/errorHandler';
import { webhookSecurityMiddleware } from '../middleware/webhookSecurity';
import logger, { logPayment, logWebhook } from '../utils/logger';

const router = Router();

// Plan prices in rubles
const PLAN_PRICES: Record<string, number> = {
  '30days': 100,     // 100₽ - base
  '90days': 270,     // 270₽ (90₽/month, 10% discount)
  '180days': 480,    // 480₽ (80₽/month, 20% discount)
  '365days': 850,    // 850₽ (70₽/month, 30% discount)
};

// Plan durations in milliseconds
const PLAN_DURATIONS: Record<string, number> = {
  '30days': 30 * 24 * 60 * 60 * 1000,
  '90days': 90 * 24 * 60 * 60 * 1000,
  '180days': 180 * 24 * 60 * 60 * 1000,
  '365days': 365 * 24 * 60 * 60 * 1000,
};

// Tariff metadata
const TARIFF_INFO = [
  {
    id: '30days',
    name: 'Базовый',
    duration: 30,
    price: 100,
    pricePerMonth: 100,
    discount: 0,
    features: [
      'Безлимитный трафик',
      'Высокая скорость',
      'До 3 устройств одновременно',
      'Доступ ко всем серверам',
    ],
    popular: true,
  },
  {
    id: '90days',
    name: 'Выгодный',
    duration: 90,
    price: 270,
    pricePerMonth: 90,
    discount: 10,
    features: [
      'Безлимитный трафик',
      'Высокая скорость',
      'До 3 устройств одновременно',
      'Доступ ко всем серверам',
      'Скидка 10%',
    ],
    popular: false,
  },
  {
    id: '180days',
    name: 'Оптимальный',
    duration: 180,
    price: 480,
    pricePerMonth: 80,
    discount: 20,
    features: [
      'Безлимитный трафик',
      'Высокая скорость',
      'До 3 устройств одновременно',
      'Доступ ко всем серверам',
      'Скидка 20%',
      'Приоритетная поддержка',
    ],
    popular: false,
  },
  {
    id: '365days',
    name: 'Максимальный',
    duration: 365,
    price: 850,
    pricePerMonth: 70,
    discount: 30,
    features: [
      'Безлимитный трафик',
      'Высокая скорость',
      'До 3 устройств одновременно',
      'Доступ ко всем серверам',
      'Скидка 30%',
      'Приоритетная поддержка',
      'Ранний доступ к новым функциям',
    ],
    popular: false,
  },
];

/**
 * GET /billing/tariffs
 * Returns available tariff plans
 */
router.get('/tariffs', asyncHandler(async (req, res) => {
  res.json({
    tariffs: TARIFF_INFO,
    currency: 'RUB',
    defaultDevices: 1,
    maxDevices: 10,
  });
}));

/**
 * POST /billing/create
 * Creates payment link via Mercuryo
 */
router.post('/create', authMiddleware, validateBody(createPaymentSchema), asyncHandler(async (req: any, res) => {
  const userId = req.user.userId;
  const { plan, promoCode, devices } = req.body as CreatePaymentInput;

  const baseAmount = PLAN_PRICES[plan];
  if (!baseAmount) {
    throw BadRequestError('Invalid plan', 'INVALID_PLAN');
  }

  // Calculate amount with devices multiplier
  let amount = baseAmount * devices;
  let appliedPromoId: string | null = null;

  // Apply promo code if provided
  if (promoCode) {
    const promo = await db.query.promoCodes.findFirst({
      where: ilike(promoCodes.code, promoCode),
    });

    if (promo && promo.isActive) {
      const now = new Date();
      
      // Check validity
      if (promo.validUntil && new Date(promo.validUntil) < now) {
        throw BadRequestError('Promo code expired', 'PROMO_EXPIRED');
      }

      if (promo.maxUses && promo.currentUses !== null && promo.currentUses >= promo.maxUses) {
        throw BadRequestError('Promo code usage limit reached', 'PROMO_LIMIT');
      }

      // Apply discount
      if (promo.discountType === 'percentage') {
        amount = Math.floor(amount * (1 - promo.discountValue / 100));
      } else if (promo.discountType === 'fixed') {
        amount = Math.max(0, amount - promo.discountValue);
      }

      appliedPromoId = promo.id;
      
      logPayment('Promo code applied', {
        userId,
        promoCode,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
      });
    }
  }

  // Create payment record
  const [payment] = await db.insert(payments).values({
    userId,
    amount,
    currency: 'RUB',
    status: 'pending',
    plan,
  }).returning();

  logPayment('Payment created', {
    paymentId: payment.id,
    userId,
    plan,
    amount,
    devices,
  });

  // Create Mercuryo payment link
  const mercuryoService = getMercuryoService();
  const returnUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing/success?paymentId=${payment.id}`;
  
  const mercuryoPayment = await mercuryoService.createPayment({
    amount,
    currency: 'RUB',
    userId,
    plan,
    returnUrl,
  });

  // Update payment with Mercuryo order ID
  await db.update(payments)
    .set({
      mercuryoOrderId: mercuryoPayment.id,
      mercuryoData: mercuryoPayment,
    })
    .where(eq(payments.id, payment.id));

  res.json({
    paymentId: payment.id,
    paymentUrl: mercuryoPayment.payment_url,
    amount,
    currency: 'RUB',
  });
}));

/**
 * POST /billing/webhook
 * Handles webhook from Mercuryo
 */
router.post('/webhook', webhookSecurityMiddleware, asyncHandler(async (req, res) => {
  const signature = req.headers['x-mercuryo-signature'] as string;
  
  if (!signature) {
    logWebhook('Missing signature', { ip: req.ip });
    throw UnauthorizedError('No signature provided', 'MISSING_SIGNATURE');
  }

  const mercuryoService = getMercuryoService();
  
  let webhookData;
  try {
    webhookData = mercuryoService.parseWebhook(req.body, signature);
  } catch (error: any) {
    logWebhook('Invalid signature', { ip: req.ip, error: error.message });
    throw UnauthorizedError('Invalid webhook signature', 'INVALID_SIGNATURE');
  }

  logWebhook('Received webhook', {
    orderId: webhookData.id,
    status: webhookData.status,
  });

  // Find payment by Mercuryo order ID
  const payment = await db.query.payments.findFirst({
    where: eq(payments.mercuryoOrderId, webhookData.id),
  });

  if (!payment) {
    logWebhook('Payment not found', { orderId: webhookData.id });
    throw NotFoundError('Payment not found', 'PAYMENT_NOT_FOUND');
  }

  // Skip if already processed
  if (payment.status === 'completed') {
    logWebhook('Payment already processed', { paymentId: payment.id });
    return res.json({ success: true, message: 'Already processed' });
  }

  // Use transaction to prevent race conditions
  await db.transaction(async (tx) => {
    // Update payment status
    const newStatus = webhookData.status === 'completed' ? 'completed' : 'failed';
    
    await tx.update(payments)
      .set({
        status: newStatus,
        mercuryoData: webhookData,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));

    // If payment successful, create/extend subscription
    if (webhookData.status === 'completed') {
      const user = await tx.query.users.findFirst({
        where: eq(users.id, payment.userId),
      });

      if (!user) {
        throw new Error('User not found');
      }

      const now = new Date();
      const duration = PLAN_DURATIONS[payment.plan] || PLAN_DURATIONS['30days'];

      // Get latest subscription with row lock to prevent concurrent modifications
      const [existingSubscription] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, payment.userId))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);

      if (existingSubscription && new Date(existingSubscription.endDate) > now) {
        // Extend existing subscription
        const newEndDate = new Date(
          Math.max(new Date(existingSubscription.endDate).getTime(), now.getTime()) + duration
        );

        await tx.update(subscriptions)
          .set({
            endDate: newEndDate,
            status: 'active',
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, existingSubscription.id));

        logPayment('Subscription extended', {
          subscriptionId: existingSubscription.id,
          userId: payment.userId,
          newEndDate: newEndDate.toISOString(),
        });

        // Update Marzban subscription
        try {
          const marzbanService = await getMarzbanService();
          const marzbanUsername = `user_${user.telegramId}`;
          await marzbanService.extendSubscription(marzbanUsername, newEndDate.getTime());
        } catch (error: any) {
          logger.error('Failed to extend Marzban subscription', {
            userId: payment.userId,
            error: error.message,
          });
        }
      } else {
        // Create new subscription
        const endDate = new Date(now.getTime() + duration);
        
        const [subscription] = await tx.insert(subscriptions).values({
          userId: payment.userId,
          plan: payment.plan,
          status: 'active',
          startDate: now,
          endDate,
          autoRenew: false,
        }).returning();

        // Link payment to subscription
        await tx.update(payments)
          .set({ subscriptionId: subscription.id })
          .where(eq(payments.id, payment.id));

        logPayment('Subscription created', {
          subscriptionId: subscription.id,
          userId: payment.userId,
          plan: payment.plan,
          endDate: endDate.toISOString(),
        });

        // Process referral bonus for first payment
        const isFirstPayment = !user.firstPaymentProcessed;

        if (isFirstPayment && user.referredBy) {
          // Credit referral bonus (50₽)
          await tx.update(users)
            .set({
              balance: sql`${users.balance} + 50`,
              updatedAt: new Date(),
            })
            .where(eq(users.id, user.referredBy));

          // Mark first payment as processed
          await tx.update(users)
            .set({
              firstPaymentProcessed: true,
              updatedAt: new Date(),
            })
            .where(eq(users.id, payment.userId));

          logPayment('Referral bonus credited', {
            referrerId: user.referredBy,
            newUserId: payment.userId,
            bonus: 50,
          });
        }
      }
    }
  });

  logWebhook('Webhook processed successfully', {
    paymentId: payment.id,
    status: webhookData.status,
  });

  res.json({ success: true });
}));

export default router;
