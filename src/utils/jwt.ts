// @ts-nocheck
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// SECURITY: No fallback - app must fail without JWT_SECRET
const JWT_SECRET_RAW = process.env.JWT_SECRET;
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '1h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

if (!JWT_SECRET_RAW) {
  throw new Error('FATAL: JWT_SECRET environment variable must be defined');
}

// Validate JWT_SECRET strength
if (JWT_SECRET_RAW.length < 32) {
  throw new Error('FATAL: JWT_SECRET must be at least 32 characters long');
}

// Type assertion after validation
const JWT_SECRET: jwt.Secret = JWT_SECRET_RAW;

export interface JWTPayload {
  userId: string;
  telegramId: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
  type: 'refresh';
}

/**
 * Parse expires in string to seconds
 */
function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) return 3600; // default 1 hour
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return 3600;
  }
}

// Pre-calculate expiry times in seconds for numeric usage
const ACCESS_EXPIRES_SECONDS = parseExpiresIn(JWT_ACCESS_EXPIRES_IN);
const REFRESH_EXPIRES_SECONDS = parseExpiresIn(JWT_REFRESH_EXPIRES_IN);

/**
 * Создает пару токенов (access + refresh) для пользователя
 */
export function createTokenPair(payload: JWTPayload): TokenPair {
  const tokenId = crypto.randomUUID();
  
  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_EXPIRES_SECONDS,
    algorithm: 'HS256',
  });
  
  const refreshPayload: RefreshTokenPayload = {
    userId: payload.userId,
    tokenId,
    type: 'refresh',
  };
  
  const refreshToken = jwt.sign(refreshPayload, JWT_SECRET, {
    expiresIn: REFRESH_EXPIRES_SECONDS,
    algorithm: 'HS256',
  });
  
  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_EXPIRES_SECONDS,
  };
}

/**
 * Создает только access токен (для обратной совместимости)
 */
export function createToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_EXPIRES_SECONDS,
    algorithm: 'HS256',
  });
}

/**
 * Проверяет и декодирует access токен
 */
export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'], // Only allow HS256
    });
    
    const payload = decoded as JWTPayload;
    
    // Validate payload structure
    if (!payload.userId || !payload.telegramId) {
      throw new Error('Invalid token payload');
    }
    
    return payload;
  } catch (error: unknown) {
    const err = error as Error & { name?: string };
    if (err.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    }
    if (err.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw new Error('Token verification failed');
  }
}

/**
 * Проверяет refresh токен и возвращает новую пару токенов
 */
export function refreshAccessToken(refreshToken: string, telegramId: string): TokenPair {
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET, {
      algorithms: ['HS256'],
    });
    
    const payload = decoded as RefreshTokenPayload;
    
    // Validate it's a refresh token
    if (payload.type !== 'refresh') {
      throw new Error('Invalid refresh token');
    }
    
    // Create new token pair
    return createTokenPair({
      userId: payload.userId,
      telegramId,
    });
  } catch (error: unknown) {
    const err = error as Error & { name?: string };
    if (err.name === 'TokenExpiredError') {
      throw new Error('Refresh token expired');
    }
    throw new Error('Invalid refresh token');
  }
}

/**
 * Middleware для проверки JWT токена
 */
export function authMiddleware(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    
    if (!token || token === 'undefined' || token === 'null') {
      return res.status(401).json({ error: 'Invalid token format' });
    }
    
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error: unknown) {
    const err = error as Error;
    const message = err.message || 'Invalid token';
    const isExpired = message.includes('expired');
    
    return res.status(401).json({
      error: message,
      code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
    });
  }
}
