# ⚠️ TECH STACK - OUTLIVION API

> **🚨 ВНИМАНИЕ: НЕ УДАЛЯТЬ ЭТОТ ФАЙЛ!**  
> Эта документация критически важна для понимания архитектуры проекта.

---

## 🎯 Назначение
Backend API сервер для VPN платформы Outlivion

---

## 🛠️ Технологии

### Core
- **Node.js 20+** - Runtime
- **Express.js** - Web framework
- **TypeScript** - Язык программирования
- **Port:** 3001 (dev) / Railway (prod)

### База данных
- **Neon PostgreSQL** - Serverless database
- **Drizzle ORM** - Database toolkit
- **pg** - PostgreSQL client

### Безопасность
- **JWT** - Аутентификация (1h access, 7d refresh)
- **Helmet** - Security headers
- **express-rate-limit** - Rate limiting
- **CORS** - Cross-origin защита
- **Zod** - Валидация схем

### Утилиты
- **Winston** - Логирование
- **node-cron** - Фоновые задачи
- **axios** - HTTP клиент
- **qrcode** - Генерация QR кодов

---

## 🔗 Внешние интеграции

### 1. Neon PostgreSQL
```env
DATABASE_URL=postgresql://...@ep-xxxxx.region.aws.neon.tech/outlivion_db?sslmode=require
```
- Serverless PostgreSQL
- SSL обязателен
- Console: https://console.neon.tech

### 2. Marzban VPN Panel
```env
MARZBAN_URL=https://your-marzban-panel.com
MARZBAN_USERNAME=admin
MARZBAN_PASSWORD=password
```
- Управление VPN пользователями
- VLESS конфигурации
- API: `/api/admin/token`, `/api/user/*`

### 3. Mercuryo Payment Gateway
```env
MERCURYO_API_KEY=key
MERCURYO_SECRET=secret
MERCURYO_WEBHOOK_SECRET=webhook_secret
```
- Крипто-платежи
- HMAC SHA256 подпись webhook
- API: `/v1.6/payment`

### 4. Telegram Bot API
```env
TELEGRAM_BOT_TOKEN=8477147639:AAEVS_D_A4avYXPOku78AWiYbiirOgglpbw
```
- Создание пользователей через бота
- Webhook от Mini App
- Специальный маркер: `hash: 'bot-created-user'`

---

## 📊 Структура БД (8 таблиц)

```
users              - Пользователи (telegramId, balance, referredBy)
subscriptions      - Подписки (plan, status, startDate, endDate)
payments           - Платежи (amount, status, mercuryoOrderId)
servers            - VPN серверы (host, port, location, load)
configs            - VLESS конфигурации (marzbanUserId, vlessConfig, qrCode)
promo_codes        - Промокоды (code, discountType, discountValue)
user_promo_codes   - Использование промокодов
logs               - Системные логи
```

---

## 🔌 API Endpoints

### Авторизация
- `POST /auth/telegram` - Вход через Telegram (поддержка бота)
- `POST /auth/refresh` - Обновление токена

### Пользователь
- `GET /user/me` - Данные пользователя
- `GET /user/subscription` - Текущая подписка
  - Поддержка `?telegramId=xxx` для бота
- `GET /user/transactions` - История платежей

### Оплата
- `POST /billing/create` - Создать платеж
- `POST /billing/webhook` - Webhook от Mercuryo

### Серверы
- `GET /servers` - Список серверов
- `GET /servers/:id/config` - VLESS конфигурация

### Промокоды
- `POST /promo/apply` - Активировать промокод
- `GET /promo/validate/:code` - Проверить промокод

### Админ (Dashboard)
- `GET /admin/stats` - Статистика
- `GET /admin/users` - Список пользователей
- `GET /admin/servers` - Серверы
- `GET /admin/payments` - Платежи
- `GET /admin/subscriptions` - Подписки

---

## 🔄 Cron Jobs

```typescript
// src/cron/subscriptions.ts
- Проверка истекших подписок (каждые 10 минут)
- Автопродление подписок
- Уведомления об окончании
```

---

## 🚀 Deployment

### Platform: Railway
- URL: https://api.outlivion.space
- Auto-deploy из GitHub (main branch)
- PostgreSQL: Neon (не Railway Postgres!)

### Миграции
```bash
pnpm db:migrate     # Применить миграции
pnpm db:seed        # Заполнить тестовыми данными
pnpm db:studio      # Drizzle Studio GUI
```

---

## 🔐 Критические переменные окружения

```env
# Database (ОБЯЗАТЕЛЬНО!)
DATABASE_URL=postgresql://...neon.tech/outlivion_db?sslmode=require

# Server
PORT=3001
NODE_ENV=production

# JWT (min 32 chars!)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_ACCESS_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Telegram
TELEGRAM_BOT_TOKEN=8477147639:AAEVS_D_A4avYXPOku78AWiYbiirOgglpbw

# Marzban (для production)
MARZBAN_URL=https://your-marzban-panel.com
MARZBAN_USERNAME=admin
MARZBAN_PASSWORD=password

# Mercuryo (для production)
MERCURYO_API_KEY=key
MERCURYO_SECRET=secret
MERCURYO_WEBHOOK_SECRET=webhook_secret

# Frontend URLs (PRODUCTION)
FRONTEND_URL=https://outlivion.space
PORTAL_URL=https://portal.outlivion.space
MINIAPP_URL=https://app.outlivion.space
LANDING_URL=https://outlivion.space
DASHBOARD_URL=https://dashboard.outlivion.space
```

---

## 🔗 Связи с другими компонентами

```
Mini App (app.outlivion.space)
    ↓ REST API + JWT
outlivion-api (api.outlivion.space)
    ↓ SQL + SSL
Neon PostgreSQL
```

```
Dashboard (dashboard.outlivion.space)
    ↓ /admin/* endpoints
outlivion-api (api.outlivion.space)
    ↓
Marzban + Mercuryo + Telegram
```

---

## ⚡ Команды

```bash
pnpm dev            # Разработка (port 3001)
pnpm build          # Сборка TypeScript
pnpm start          # Production
pnpm db:migrate     # Миграции
pnpm db:seed        # Seed данных
pnpm db:studio      # DB GUI
```

---

## 📝 Важные заметки

1. **Neon SSL обязателен** - `sslmode=require` в production
2. **Bot запросы** - специальный маркер `hash: 'bot-created-user'`
3. **Webhook security** - HMAC подпись для Mercuryo
4. **Rate limiting** - защита от злоупотреблений
5. **JWT tokens** - Access 1h, Refresh 7d
6. **Cron jobs** - проверка подписок каждые 10 минут

---

**Версия:** 1.0.0  
**Последнее обновление:** Декабрь 2025  
**Платформа:** Railway + Neon PostgreSQL

