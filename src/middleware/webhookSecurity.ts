// @ts-nocheck
import { Request, Response, NextFunction } from 'express';
import logger, { logSecurity } from '../utils/logger';

// Mercuryo IP ranges (example - should be updated with actual IPs from Mercuryo documentation)
// In production, these should come from environment variables or a configuration file
const MERCURYO_IP_RANGES = (process.env.MERCURYO_ALLOWED_IPS || '')
  .split(',')
  .map(ip => ip.trim())
  .filter(Boolean);

// Allow all IPs if not configured (for development)
const STRICT_IP_CHECK = process.env.WEBHOOK_STRICT_IP_CHECK === 'true';

// Request timestamp tolerance (5 minutes)
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Checks if an IP is in the allowed list
 */
function isIPAllowed(clientIP: string | undefined): boolean {
  if (!clientIP) return false;
  
  // In development or if not configured, allow all
  if (!STRICT_IP_CHECK || MERCURYO_IP_RANGES.length === 0) {
    return true;
  }
  
  // Normalize IP (remove IPv6 prefix if present)
  const normalizedIP = clientIP.replace(/^::ffff:/, '');
  
  // Check if IP is in allowed list
  return MERCURYO_IP_RANGES.some(allowedIP => {
    // Exact match
    if (normalizedIP === allowedIP) return true;
    
    // CIDR range check (simplified - for /24 ranges)
    if (allowedIP.includes('/')) {
      const [range, mask] = allowedIP.split('/');
      const maskBits = parseInt(mask, 10);
      
      if (maskBits === 24) {
        const rangePrefix = range.split('.').slice(0, 3).join('.');
        const ipPrefix = normalizedIP.split('.').slice(0, 3).join('.');
        return rangePrefix === ipPrefix;
      }
    }
    
    return false;
  });
}

/**
 * Validates request timestamp to prevent replay attacks
 */
function isTimestampValid(timestamp: string | undefined): boolean {
  if (!timestamp) return true; // Skip if no timestamp header
  
  const requestTime = parseInt(timestamp, 10) * 1000; // Convert to ms
  const now = Date.now();
  const diff = Math.abs(now - requestTime);
  
  return diff <= TIMESTAMP_TOLERANCE_MS;
}

/**
 * Webhook security middleware
 * - Validates IP address
 * - Validates request timestamp
 * - Logs suspicious requests
 */
export function webhookSecurityMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const clientIP = req.ip || (req.headers['x-forwarded-for'] as string) || '';
  const timestamp = req.headers['x-mercuryo-timestamp'] as string | undefined;
  const requestId = req.headers['x-mercuryo-request-id'] as string | undefined;
  
  // Log all webhook requests
  logger.info('Webhook request received', {
    ip: clientIP,
    timestamp,
    requestId,
    path: req.path,
    userAgent: req.get('user-agent')?.substring(0, 100),
  });
  
  // Check IP if strict mode is enabled
  if (STRICT_IP_CHECK && !isIPAllowed(clientIP)) {
    logSecurity('Webhook blocked - unauthorized IP', {
      ip: clientIP,
      allowedIPs: MERCURYO_IP_RANGES,
    });
    
    res.status(403).json({
      error: 'Forbidden',
      code: 'UNAUTHORIZED_IP',
    });
    return;
  }
  
  // Check timestamp to prevent replay attacks
  if (timestamp && !isTimestampValid(timestamp)) {
    logSecurity('Webhook blocked - expired timestamp', {
      ip: clientIP,
      timestamp,
      serverTime: Math.floor(Date.now() / 1000),
    });
    
    res.status(401).json({
      error: 'Request expired',
      code: 'EXPIRED_REQUEST',
    });
    return;
  }
  
  // Attach metadata to request for logging
  (req as any).webhookMeta = {
    ip: clientIP,
    timestamp,
    requestId,
    receivedAt: new Date().toISOString(),
  };
  
  next();
}

/**
 * Store processed webhook IDs to prevent duplicate processing
 * In production, this should use Redis or database
 */
const processedWebhooks = new Set<string>();
const WEBHOOK_CACHE_SIZE = 10000;

/**
 * Check if webhook was already processed (idempotency)
 */
export function isWebhookProcessed(webhookId: string): boolean {
  return processedWebhooks.has(webhookId);
}

/**
 * Mark webhook as processed
 */
export function markWebhookProcessed(webhookId: string): void {
  processedWebhooks.add(webhookId);
  
  // Clean up old entries if cache is too large
  if (processedWebhooks.size > WEBHOOK_CACHE_SIZE) {
    const iterator = processedWebhooks.values();
    for (let i = 0; i < WEBHOOK_CACHE_SIZE / 2; i++) {
      const value = iterator.next().value;
      if (value) {
        processedWebhooks.delete(value);
      }
    }
  }
}
