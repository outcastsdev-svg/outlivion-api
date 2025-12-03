// @ts-nocheck
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// Custom error class with status code
export class ApiError extends Error {
  status: number;
  code?: string;
  isOperational: boolean;

  constructor(message: string, status: number = 500, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.isOperational = true; // Operational errors vs programming errors
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error factory functions
export const BadRequestError = (message: string, code?: string) => 
  new ApiError(message, 400, code || 'BAD_REQUEST');

export const UnauthorizedError = (message: string = 'Unauthorized', code?: string) => 
  new ApiError(message, 401, code || 'UNAUTHORIZED');

export const ForbiddenError = (message: string = 'Forbidden', code?: string) => 
  new ApiError(message, 403, code || 'FORBIDDEN');

export const NotFoundError = (message: string = 'Not found', code?: string) => 
  new ApiError(message, 404, code || 'NOT_FOUND');

export const ConflictError = (message: string, code?: string) => 
  new ApiError(message, 409, code || 'CONFLICT');

export const ValidationError = (message: string, code?: string) => 
  new ApiError(message, 422, code || 'VALIDATION_ERROR');

export const InternalError = (message: string = 'Internal server error', code?: string) => 
  new ApiError(message, 500, code || 'INTERNAL_ERROR');

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Determine if it's an operational error
  const isOperational = err instanceof ApiError && err.isOperational;
  const status = err instanceof ApiError ? err.status : 500;
  const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';

  // Log the error
  const errorLog = {
    message: err.message,
    status,
    code,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?.userId,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  };

  if (status >= 500) {
    logger.error('Server error', errorLog);
  } else if (status >= 400) {
    logger.warn('Client error', errorLog);
  }

  // Don't leak error details in production for non-operational errors
  const isProduction = process.env.NODE_ENV === 'production';
  const message = isProduction && !isOperational 
    ? 'Internal server error' 
    : err.message;

  // Send response
  res.status(status).json({
    error: message,
    code,
    ...(process.env.NODE_ENV !== 'production' && {
      stack: err.stack,
    }),
  });
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  logger.debug('Route not found', {
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  res.status(404).json({
    error: 'Route not found',
    code: 'NOT_FOUND',
    path: req.path,
  });
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

