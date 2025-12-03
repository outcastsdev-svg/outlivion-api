/**
 * Rate limiting middleware specifically for Bot Auth endpoints
 * Different limits for different endpoints
 */

import rateLimit from 'express-rate-limit';

/**
 * Create login token rate limiter
 * Limit: 5 tokens per minute per IP
 * This prevents token spam attacks
 */
export const createTokenLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message: { 
    error: 'Too many login attempts. Please try again in a minute.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

/**
 * Check login status rate limiter
 * Limit: 60 requests per minute per IP (for polling)
 * Frontend polls every 2 seconds, so ~30 requests per minute max
 */
export const checkLoginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: { 
    error: 'Too many status check requests.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

/**
 * Confirm login rate limiter (from bot)
 * Limit: 10 confirmations per minute
 * This should be called only once per login attempt
 */
export const confirmLoginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: { 
    error: 'Too many confirmation requests.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Cleanup rate limiter
 * Limit: 5 requests per hour (admin/cron only)
 */
export const cleanupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { 
    error: 'Too many cleanup requests.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

