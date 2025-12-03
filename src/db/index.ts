// @ts-nocheck
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import dotenv from 'dotenv';

// Load environment variables (safe to call multiple times)
dotenv.config();

// На Vercel переменные окружения загружаются автоматически
// Для локальной разработки dotenv загружается здесь

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Available env vars:', Object.keys(process.env).filter(k => !k.startsWith('npm_')));
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export const db = drizzle(pool, { schema });

