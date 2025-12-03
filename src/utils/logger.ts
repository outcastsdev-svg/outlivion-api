// @ts-nocheck
import winston from 'winston';

const { combine, timestamp, json, colorize, simple, errors } = winston.format;

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Determine log level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : (process.env.LOG_LEVEL || 'info');
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// Console format for development
const consoleFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// JSON format for production
const productionFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

// Transports
const transports: winston.transport[] = [
  // Console transport - always enabled
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? productionFormat : consoleFormat,
  }),
];

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  transports.push(
    // Error log file
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: productionFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined log file
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: productionFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: level(),
  levels,
  defaultMeta: { service: 'outlivion-backend' },
  transports,
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Stream for Morgan HTTP logger (if needed)
export const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Helper methods for structured logging
export const logAuth = (action: string, data: Record<string, unknown>) => {
  logger.info(`[AUTH] ${action}`, { category: 'auth', ...data });
};

export const logPayment = (action: string, data: Record<string, unknown>) => {
  logger.info(`[PAYMENT] ${action}`, { category: 'payment', ...data });
};

export const logWebhook = (action: string, data: Record<string, unknown>) => {
  logger.info(`[WEBHOOK] ${action}`, { category: 'webhook', ...data });
};

export const logMarzban = (action: string, data: Record<string, unknown>) => {
  logger.info(`[MARZBAN] ${action}`, { category: 'marzban', ...data });
};

export const logSecurity = (action: string, data: Record<string, unknown>) => {
  logger.warn(`[SECURITY] ${action}`, { category: 'security', ...data });
};

export default logger;

