// @ts-nocheck
import { pgTable, uuid, varchar, timestamp, boolean, integer, text, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  telegramId: varchar('telegram_id', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 255 }),
  firstName: varchar('first_name', { length: 255 }),
  lastName: varchar('last_name', { length: 255 }),
  photoUrl: text('photo_url'),
  balance: integer('balance').default(0).notNull(),
  referredBy: uuid('referred_by').references(() => users.id),
  firstPaymentProcessed: boolean('first_payment_processed').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  telegramIdIdx: index('telegram_id_idx').on(table.telegramId),
  referredByIdx: index('referred_by_idx').on(table.referredBy),
}));

// Subscriptions table
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  plan: varchar('plan', { length: 50 }).notNull(), // 'monthly', 'yearly', etc.
  status: varchar('status', { length: 50 }).notNull().default('active'), // 'active', 'expired', 'cancelled'
  startDate: timestamp('start_date').defaultNow().notNull(),
  endDate: timestamp('end_date').notNull(),
  autoRenew: boolean('auto_renew').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('user_id_idx').on(table.userId),
  statusIdx: index('status_idx').on(table.status),
}));

// Payments table
export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
  amount: integer('amount').notNull(), // in cents
  currency: varchar('currency', { length: 10 }).default('USD'),
  status: varchar('status', { length: 50 }).notNull().default('pending'), // 'pending', 'completed', 'failed', 'refunded'
  mercuryoOrderId: varchar('mercuryo_order_id', { length: 255 }),
  mercuryoData: jsonb('mercuryo_data'),
  plan: varchar('plan', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('payments_user_id_idx').on(table.userId),
  statusIdx: index('payments_status_idx').on(table.status),
  mercuryoOrderIdIdx: index('mercuryo_order_id_idx').on(table.mercuryoOrderId),
}));

// Servers table
export const servers = pgTable('servers', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  host: varchar('host', { length: 255 }).notNull(),
  port: integer('port').notNull(),
  location: varchar('location', { length: 255 }),
  country: varchar('country', { length: 10 }),
  isActive: boolean('is_active').default(true),
  load: integer('load').default(0), // 0-100
  maxUsers: integer('max_users').default(1000),
  currentUsers: integer('current_users').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Configs table (user-server configurations)
export const configs = pgTable('configs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  serverId: uuid('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
  marzbanUserId: varchar('marzban_user_id', { length: 255 }).notNull().unique(),
  vlessConfig: text('vless_config').notNull(),
  qrCode: text('qr_code'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('configs_user_id_idx').on(table.userId),
  serverIdIdx: index('configs_server_id_idx').on(table.serverId),
  marzbanUserIdIdx: index('marzban_user_id_idx').on(table.marzbanUserId),
}));

// Promo codes table
export const promoCodes = pgTable('promo_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  discountType: varchar('discount_type', { length: 20 }).notNull(), // 'percentage', 'fixed'
  discountValue: integer('discount_value').notNull(),
  maxUses: integer('max_uses'),
  currentUses: integer('current_uses').default(0),
  validFrom: timestamp('valid_from').defaultNow().notNull(),
  validUntil: timestamp('valid_until'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  codeIdx: index('promo_code_idx').on(table.code),
}));

// User promo codes usage
export const userPromoCodes = pgTable('user_promo_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  promoCodeId: uuid('promo_code_id').notNull().references(() => promoCodes.id, { onDelete: 'cascade' }),
  paymentId: uuid('payment_id').references(() => payments.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdPromoIdx: index('user_promo_idx').on(table.userId, table.promoCodeId),
}));

// Logs table
export const logs = pgTable('logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  type: varchar('type', { length: 50 }).notNull(), // 'auth', 'payment', 'api', 'error'
  level: varchar('level', { length: 20 }).notNull(), // 'info', 'warn', 'error'
  message: text('message').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('logs_user_id_idx').on(table.userId),
  typeIdx: index('logs_type_idx').on(table.type),
  createdAtIdx: index('logs_created_at_idx').on(table.createdAt),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  subscriptions: many(subscriptions),
  payments: many(payments),
  configs: many(configs),
  promoCodeUsages: many(userPromoCodes),
  logs: many(logs),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
  subscription: one(subscriptions, {
    fields: [payments.subscriptionId],
    references: [subscriptions.id],
  }),
}));

export const serversRelations = relations(servers, ({ many }) => ({
  configs: many(configs),
}));

export const configsRelations = relations(configs, ({ one }) => ({
  user: one(users, {
    fields: [configs.userId],
    references: [users.id],
  }),
  server: one(servers, {
    fields: [configs.serverId],
    references: [servers.id],
  }),
}));

export const promoCodesRelations = relations(promoCodes, ({ many }) => ({
  usages: many(userPromoCodes),
}));

export const userPromoCodesRelations = relations(userPromoCodes, ({ one }) => ({
  user: one(users, {
    fields: [userPromoCodes.userId],
    references: [users.id],
  }),
  promoCode: one(promoCodes, {
    fields: [userPromoCodes.promoCodeId],
    references: [promoCodes.id],
  }),
  payment: one(payments, {
    fields: [userPromoCodes.paymentId],
    references: [payments.id],
  }),
}));


