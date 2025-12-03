// @ts-nocheck
// Load environment variables FIRST before any imports
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import paymentRoutes from './routes/payment';
import promoRoutes from './routes/promo';
import serverRoutes from './routes/servers';
import { startSubscriptionChecker } from './cron/subscriptions';
import logger from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Trust proxy (needed for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// ===================
// Security Middleware
// ===================

// Helmet - Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for API
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
}));

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3002', // MiniApp
  'http://127.0.0.1:3002', // MiniApp
  'https://heel-subscribers-originally-jesse.trycloudflare.com', // MiniApp public URL
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Telegram-Init-Data'],
  maxAge: 86400, // 24 hours
}));

// ===================
// Rate Limiting
// ===================

// General rate limit - 100 requests per 15 minutes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
});

// Strict rate limit for auth - 5 requests per hour
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 auth attempts per hour
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit for payment endpoints - 20 requests per minute
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: { error: 'Too many payment requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Webhook rate limit - 60 requests per minute (higher for automated systems)
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: { error: 'Too many webhook requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiter to all routes
app.use(generalLimiter);

// ===================
// Body Parsers
// ===================

app.use(express.json({ limit: '10kb' })); // Limit body size
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ===================
// Request Logging
// ===================

app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')?.substring(0, 100),
    };
    
    if (res.statusCode >= 400) {
      logger.warn('Request completed with error', logData);
    } else if (!req.path.includes('/health')) {
      logger.info('Request completed', logData);
    }
  });
  
  next();
});

// ===================
// Health Check
// ===================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
  });
});

// ===================
// API Routes
// ===================

// Auth routes with strict rate limiting
app.use('/auth', authLimiter, authRoutes);

// User routes
app.use('/user', userRoutes);

// Payment routes with payment rate limiting
app.use('/billing/webhook', webhookLimiter); // Webhook has its own limit
app.use('/billing', paymentLimiter, paymentRoutes);

// Promo routes
app.use('/promo', promoRoutes);

// Server routes
app.use('/servers', serverRoutes);

// ===================
// Error Handling
// ===================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ===================
// Server Startup (only for local development)
// ===================

// Check if running on Vercel (serverless) or locally
const isVercel = process.env.VERCEL === '1';

if (!isVercel) {
  const server = app.listen(PORT, () => {
    logger.info(`Server started`, {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
    });
    
    // Start cron jobs (only in non-serverless environment)
    startSubscriptionChecker();
    logger.info('Cron jobs initialized');
  });

  // Graceful shutdown
  const gracefulShutdown = (signal: string) => {
    logger.info(`${signal} received, starting graceful shutdown...`);
    
    server.close((err) => {
      if (err) {
        logger.error('Error during server close', { error: err.message });
        process.exit(1);
      }
      
      logger.info('Server closed successfully');
      process.exit(0);
    });
    
    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason: String(reason) });
  });
}

// Export for Vercel serverless
// Vercel expects a handler function, not the app itself
export default (req: any, res: any) => {
  return app(req, res);
};
