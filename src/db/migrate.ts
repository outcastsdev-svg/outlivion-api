// @ts-nocheck
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './index';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

async function runMigrations() {
  console.log('Running migrations...');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set in .env file');
    console.log('Please create .env file with DATABASE_URL=postgresql://user:password@localhost:5432/outlivion_db');
    process.exit(1);
  }
  
  console.log('Database URL:', process.env.DATABASE_URL ? '✓ Set' : '✗ Not set');
  
  try {
    const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
    console.log('Migrations folder:', migrationsFolder);
    
    await migrate(db, { 
      migrationsFolder,
    });
    console.log('✅ Migrations completed!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Make sure PostgreSQL is running and DATABASE_URL is correct');
    }
    process.exit(1);
  }
}

runMigrations();

