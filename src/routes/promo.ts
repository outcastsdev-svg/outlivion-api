// @ts-nocheck
import { Router } from 'express';
import { db } from '../db';
import { promoCodes } from '../db/schema';
import { ilike } from 'drizzle-orm';
import { validateBody, applyPromoSchema, ApplyPromoInput } from '../middleware/validation';
import { asyncHandler, NotFoundError, BadRequestError } from '../middleware/errorHandler';
import logger from '../utils/logger';

const router = Router();

/**
 * POST /promo/apply
 * Проверяет промокод и возвращает информацию о скидке
 */
router.post('/apply', validateBody(applyPromoSchema), asyncHandler(async (req, res) => {
  const { code } = req.body as ApplyPromoInput;

  const promo = await db.query.promoCodes.findFirst({
    where: ilike(promoCodes.code, code),
  });

  if (!promo) {
    logger.debug('Promo code not found', { code });
    throw NotFoundError('Promo code not found', 'PROMO_NOT_FOUND');
  }

  if (!promo.isActive) {
    logger.debug('Promo code inactive', { code });
    throw BadRequestError('Promo code is inactive', 'PROMO_INACTIVE');
  }

  // Check validity period
  const now = new Date();
  
  if (promo.validUntil && new Date(promo.validUntil) < now) {
    logger.debug('Promo code expired', { code, validUntil: promo.validUntil });
    throw BadRequestError('Promo code expired', 'PROMO_EXPIRED');
  }

  if (new Date(promo.validFrom) > now) {
    logger.debug('Promo code not yet valid', { code, validFrom: promo.validFrom });
    throw BadRequestError('Promo code not yet valid', 'PROMO_NOT_STARTED');
  }

  // Check usage limit
  if (promo.maxUses && promo.currentUses !== null && promo.currentUses >= promo.maxUses) {
    logger.debug('Promo code usage limit reached', { 
      code, 
      maxUses: promo.maxUses, 
      currentUses: promo.currentUses,
    });
    throw BadRequestError('Promo code usage limit reached', 'PROMO_LIMIT_REACHED');
  }

  logger.info('Promo code validated', { code, discountType: promo.discountType });

  res.json({
    code: promo.code,
    discountType: promo.discountType,
    discountValue: promo.discountValue,
    valid: true,
  });
}));

export default router;
