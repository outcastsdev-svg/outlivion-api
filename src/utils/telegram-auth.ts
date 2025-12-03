// @ts-nocheck
import crypto from 'crypto';

interface TelegramAuthData {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: string;
  hash: string;
}

// SECURITY: Mock auth is controlled by explicit env variable, not NODE_ENV
const ALLOW_MOCK_AUTH = process.env.ALLOW_MOCK_AUTH === 'true';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Security check at startup
if (IS_PRODUCTION && ALLOW_MOCK_AUTH) {
  console.error('!!! SECURITY ALERT !!!');
  console.error('ALLOW_MOCK_AUTH is enabled in production!');
  console.error('This is a critical security vulnerability!');
  console.error('Set ALLOW_MOCK_AUTH=false or remove it from environment.');
  // In production, we force disable mock auth
}

/**
 * Проверяет подлинность данных авторизации Telegram
 */
export function verifyTelegramAuth(data: TelegramAuthData, botToken: string): boolean {
  const { hash, ...userData } = data;
  
  // Mock auth handling with strict security
  if (hash === 'mock_hash_for_development') {
    // NEVER allow mock auth in production
    if (IS_PRODUCTION) {
      console.error('[SECURITY] Mock auth attempt blocked in production');
      return false;
    }
    
    // Only allow if explicitly enabled via environment variable
    if (ALLOW_MOCK_AUTH) {
      console.warn('[DEV] Mock auth enabled - skipping Telegram verification');
      console.warn('[DEV] User ID:', data.id);
      return true;
    }
    
    // Mock auth not enabled
    console.warn('[AUTH] Mock hash provided but ALLOW_MOCK_AUTH is not set');
    return false;
  }
  
  // Validate required fields
  if (!data.id || !data.auth_date || !hash) {
    console.error('[AUTH] Missing required fields in Telegram auth data');
    return false;
  }
  
  // Validate auth_date is a number
  const authDate = parseInt(data.auth_date, 10);
  if (isNaN(authDate)) {
    console.error('[AUTH] Invalid auth_date format');
    return false;
  }
  
  // Создаем строку для проверки (Telegram's data-check-string)
  const dataCheckString = Object.keys(userData)
    .sort()
    .filter((key) => userData[key as keyof typeof userData] !== undefined)
    .map((key) => `${key}=${userData[key as keyof typeof userData]}`)
    .join('\n');
  
  // Создаем секретный ключ (SHA256 от токена бота)
  const secretKey = crypto
    .createHash('sha256')
    .update(botToken)
    .digest();
  
  // Вычисляем HMAC-SHA256
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  
  // Timing-safe comparison to prevent timing attacks
  try {
    const hashBuffer = Buffer.from(hash, 'hex');
    const calculatedBuffer = Buffer.from(calculatedHash, 'hex');
    
    if (hashBuffer.length !== calculatedBuffer.length) {
      return false;
    }
    
    if (!crypto.timingSafeEqual(hashBuffer, calculatedBuffer)) {
      console.warn('[AUTH] Hash mismatch for Telegram auth');
      return false;
    }
  } catch {
    console.error('[AUTH] Invalid hash format');
    return false;
  }
  
  // Проверяем, что данные не старше 24 часов
  const currentTime = Math.floor(Date.now() / 1000);
  const timeDiff = currentTime - authDate;
  
  // Maximum age: 24 hours (86400 seconds)
  const MAX_AUTH_AGE = 86400;
  
  if (timeDiff > MAX_AUTH_AGE) {
    console.warn('[AUTH] Telegram auth data expired:', {
      authDate: new Date(authDate * 1000).toISOString(),
      currentTime: new Date(currentTime * 1000).toISOString(),
      ageSeconds: timeDiff,
    });
    return false;
  }
  
  // Also check for future dates (clock skew protection)
  if (timeDiff < -300) { // Allow 5 minutes of clock skew
    console.warn('[AUTH] Telegram auth date is in the future');
    return false;
  }
  
  return true;
}

/**
 * Извлекает данные пользователя из Telegram auth данных
 */
export function extractTelegramUser(data: TelegramAuthData) {
  return {
    telegramId: data.id,
    firstName: data.first_name || null,
    lastName: data.last_name || null,
    username: data.username || null,
    photoUrl: data.photo_url || null,
  };
}

/**
 * Валидирует структуру данных Telegram auth
 */
export function validateTelegramAuthData(data: unknown): data is TelegramAuthData {
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  const obj = data as Record<string, unknown>;
  
  return (
    typeof obj.id === 'string' &&
    typeof obj.auth_date === 'string' &&
    typeof obj.hash === 'string'
  );
}

/**
 * Parse Telegram Mini App initData
 * Format: "query_id=...&user={...}&auth_date=...&hash=..."
 */
export function parseTelegramInitData(initData: string): TelegramAuthData | null {
  try {
    const params = new URLSearchParams(initData);
    
    const hash = params.get('hash');
    const authDate = params.get('auth_date');
    const userParam = params.get('user');
    
    if (!hash || !authDate || !userParam) {
      console.error('[AUTH] Missing required parameters in initData');
      return null;
    }
    
    // Parse user JSON
    const user = JSON.parse(userParam);
    
    return {
      id: String(user.id),
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      photo_url: user.photo_url,
      auth_date: authDate,
      hash,
    };
  } catch (error) {
    console.error('[AUTH] Failed to parse initData:', error);
    return null;
  }
}

/**
 * Verify Telegram Mini App initData signature
 */
export function verifyTelegramInitData(initData: string, botToken: string): boolean {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    
    if (!hash) {
      return false;
    }
    
    // Remove hash from params
    params.delete('hash');
    
    // Sort params and create data-check-string
    const dataCheckArray: string[] = [];
    params.forEach((value, key) => {
      dataCheckArray.push(`${key}=${value}`);
    });
    dataCheckArray.sort();
    const dataCheckString = dataCheckArray.join('\n');
    
    // Create secret key (SHA256 of "WebAppData" + bot token)
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();
    
    // Calculate HMAC-SHA256
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
    
    // Timing-safe comparison
    const hashBuffer = Buffer.from(hash, 'hex');
    const calculatedBuffer = Buffer.from(calculatedHash, 'hex');
    
    if (hashBuffer.length !== calculatedBuffer.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(hashBuffer, calculatedBuffer);
  } catch (error) {
    console.error('[AUTH] Failed to verify initData:', error);
    return false;
  }
}
