// @ts-nocheck
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './errorHandler';

// ===================
// Schema Definitions
// ===================

// Auth schemas
export const telegramAuthSchema = z.object({
  id: z.string().min(1).max(50),
  first_name: z.string().max(255).optional(),
  last_name: z.string().max(255).optional(),
  username: z.string().max(255).optional(),
  photo_url: z.string().url().max(2048).optional(),
  auth_date: z.string().regex(/^\d+$/),
  hash: z.string().min(1).max(128),
  referralId: z.string().max(50).optional(),
});

// Payment schemas
export const createPaymentSchema = z.object({
  plan: z.enum(['30days', '90days', '180days', '365days'], {
    errorMap: () => ({ message: 'Invalid plan. Must be one of: 30days, 90days, 180days, 365days' }),
  }),
  promoCode: z.string()
    .max(50)
    .regex(/^[A-Z0-9]*$/, 'Promo code must contain only uppercase letters and numbers')
    .optional()
    .transform(val => val?.toUpperCase()),
  devices: z.number()
    .int()
    .min(1, 'Minimum 1 device')
    .max(4, 'Maximum 4 devices')
    .default(1),
});

// Promo schemas
export const applyPromoSchema = z.object({
  code: z.string()
    .min(1, 'Promo code is required')
    .max(50)
    .transform(val => val.toUpperCase()),
});

// Server config schemas
export const serverIdParamSchema = z.object({
  serverId: z.string().uuid('Invalid server ID format'),
});

// User schemas
export const userIdParamSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
});

// Pagination schemas
export const paginationSchema = z.object({
  page: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 1)
    .refine(val => val > 0, 'Page must be positive'),
  limit: z.string()
    .optional()
    .transform(val => val ? Math.min(parseInt(val, 10), 100) : 20)
    .refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
});

// ===================
// Validation Middleware Factory
// ===================

type ValidationTarget = 'body' | 'query' | 'params';

interface ValidationOptions {
  stripUnknown?: boolean;
}

/**
 * Creates a validation middleware for the specified schema and target
 */
export function validate<T extends z.ZodSchema>(
  schema: T,
  target: ValidationTarget = 'body',
  options: ValidationOptions = {}
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req[target];
      const validated = await schema.parseAsync(data);
      
      // Replace the target with validated data
      (req as any)[target] = validated;
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.errors.map(e => {
          const path = e.path.join('.');
          return path ? `${path}: ${e.message}` : e.message;
        });
        
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: messages,
        });
      }
      
      next(error);
    }
  };
}

/**
 * Validate request body
 */
export function validateBody<T extends z.ZodSchema>(schema: T) {
  return validate(schema, 'body');
}

/**
 * Validate request query parameters
 */
export function validateQuery<T extends z.ZodSchema>(schema: T) {
  return validate(schema, 'query');
}

/**
 * Validate request URL parameters
 */
export function validateParams<T extends z.ZodSchema>(schema: T) {
  return validate(schema, 'params');
}

// ===================
// Type Exports
// ===================

export type TelegramAuthInput = z.infer<typeof telegramAuthSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type ApplyPromoInput = z.infer<typeof applyPromoSchema>;
export type ServerIdParam = z.infer<typeof serverIdParamSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;

