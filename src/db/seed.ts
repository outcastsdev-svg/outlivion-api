// @ts-nocheck
import { db } from './index';
import { servers, promoCodes } from './schema';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Seed скрипт для заполнения базы данных тестовыми данными
 */
async function seed() {
  console.log('🌱 Starting database seed...');

  try {
    // Очищаем существующие данные (опционально)
    console.log('🗑️ Clearing existing seed data...');
    await db.delete(servers);
    await db.delete(promoCodes);

    // Добавляем тестовые серверы
    console.log('🖥️ Adding test servers...');
    const testServers = [
      {
        name: 'Frankfurt DE',
        host: 'de-frankfurt-1.outlivion.com',
        port: 443,
        location: 'Frankfurt',
        country: 'DE',
        isActive: true,
        load: 25,
        maxUsers: 1000,
        currentUsers: 250,
      },
      {
        name: 'Amsterdam NL',
        host: 'nl-amsterdam-1.outlivion.com',
        port: 443,
        location: 'Amsterdam',
        country: 'NL',
        isActive: true,
        load: 45,
        maxUsers: 1000,
        currentUsers: 450,
      },
      {
        name: 'New York US',
        host: 'us-newyork-1.outlivion.com',
        port: 443,
        location: 'New York',
        country: 'US',
        isActive: true,
        load: 60,
        maxUsers: 1500,
        currentUsers: 900,
      },
      {
        name: 'Singapore SG',
        host: 'sg-singapore-1.outlivion.com',
        port: 443,
        location: 'Singapore',
        country: 'SG',
        isActive: true,
        load: 35,
        maxUsers: 800,
        currentUsers: 280,
      },
      {
        name: 'London UK',
        host: 'uk-london-1.outlivion.com',
        port: 443,
        location: 'London',
        country: 'GB',
        isActive: true,
        load: 55,
        maxUsers: 1200,
        currentUsers: 660,
      },
    ];

    for (const server of testServers) {
      await db.insert(servers).values(server);
      console.log(`  ✅ Added server: ${server.name}`);
    }

    // Добавляем тестовые промокоды
    console.log('🎁 Adding test promo codes...');
    const testPromoCodes = [
      {
        code: 'WELCOME20',
        discountType: 'percentage' as const,
        discountValue: 20,
        maxUses: 100,
        currentUses: 0,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 год
        isActive: true,
      },
      {
        code: 'SAVE50',
        discountType: 'fixed' as const,
        discountValue: 500, // $5.00 в центах
        maxUses: 50,
        currentUses: 0,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 дней
        isActive: true,
      },
      {
        code: 'YEARLY30',
        discountType: 'percentage' as const,
        discountValue: 30,
        maxUses: 200,
        currentUses: 0,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 дней
        isActive: true,
      },
      {
        code: 'TEST100',
        discountType: 'percentage' as const,
        discountValue: 100, // 100% скидка для тестирования
        maxUses: 5,
        currentUses: 0,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 дней
        isActive: true,
      },
    ];

    for (const promo of testPromoCodes) {
      await db.insert(promoCodes).values(promo);
      console.log(`  ✅ Added promo code: ${promo.code} (${promo.discountType === 'percentage' ? `${promo.discountValue}%` : `$${promo.discountValue / 100}`})`);
    }

    console.log('');
    console.log('✅ Database seed completed successfully!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`   - Servers: ${testServers.length}`);
    console.log(`   - Promo codes: ${testPromoCodes.length}`);
    console.log('');
    console.log('🎁 Available promo codes:');
    console.log('   - WELCOME20 - 20% скидка');
    console.log('   - SAVE50 - $5 скидка');
    console.log('   - YEARLY30 - 30% скидка');
    console.log('   - TEST100 - 100% скидка (для тестирования)');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

seed();

