# Переменные окружения для Railway

Скопируй эти переменные в Railway Dashboard → Settings → Variables

## Обязательные переменные (Production)

```env
# ===================
# Database
# ===================
DATABASE_URL=postgresql://neondb_owner:npg_6z5uRqgjbOFW@ep-delicate-tooth-ag5xf91b-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# ===================
# Server Configuration
# ===================
PORT=3001
NODE_ENV=production

# ===================
# JWT Authentication
# ===================
JWT_SECRET=yUNI4Gf9kzKqNcVRnGNeH4/MSxq4Wd1uSXmPK2cM2J0=
JWT_ACCESS_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# ===================
# Telegram Bot
# ===================
TELEGRAM_BOT_TOKEN=8477147639:AAEVS_D_A4avYXPOku78AWiYbiirOgglpbw

# ===================
# Frontend URLs
# ===================
FRONTEND_URL=https://portal.outlivion.space
PORTAL_URL=https://portal.outlivion.space
MINIAPP_URL=https://app.outlivion.space
LANDING_URL=https://outlivion.space
DASHBOARD_URL=https://dashboard.outlivion.space

# ===================
# Logging
# ===================
LOG_LEVEL=info
```

## Опциональные переменные (настроить позже)

```env
# ===================
# Marzban VPN Panel
# ===================
MARZBAN_URL=https://your-marzban-panel.com
MARZBAN_USERNAME=admin
MARZBAN_PASSWORD=your_marzban_password

# ===================
# Mercuryo Payment Gateway
# ===================
MERCURYO_API_KEY=your_mercuryo_api_key
MERCURYO_SECRET=your_mercuryo_secret
MERCURYO_WEBHOOK_SECRET=your_mercuryo_webhook_secret
```

## Как добавить в Railway

1. Открой проект `outlivion-api` в Railway Dashboard
2. Перейди в **Settings** → **Variables**
3. Нажми **+ New Variable**
4. Добавь каждую переменную по очереди:
   - **Name**: `DATABASE_URL`
   - **Value**: `postgresql://neondb_owner:npg_6z5uRqgjbOFW@ep-delicate-tooth-ag5xf91b-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
   - Нажми **Add**

5. Повтори для всех переменных из списка выше

## Быстрый способ (через Railway CLI)

Если установлен Railway CLI:

```bash
railway variables set DATABASE_URL="postgresql://neondb_owner:npg_6z5uRqgjbOFW@ep-delicate-tooth-ag5xf91b-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
railway variables set NODE_ENV=production
railway variables set PORT=3001
railway variables set JWT_SECRET="yUNI4Gf9kzKqNcVRnGNeH4/MSxq4Wd1uSXmPK2cM2J0="
railway variables set JWT_ACCESS_EXPIRES_IN=1h
railway variables set JWT_REFRESH_EXPIRES_IN=7d
railway variables set TELEGRAM_BOT_TOKEN="8477147639:AAEVS_D_A4avYXPOku78AWiYbiirOgglpbw"
railway variables set FRONTEND_URL="https://portal.outlivion.space"
railway variables set PORTAL_URL="https://portal.outlivion.space"
railway variables set MINIAPP_URL="https://app.outlivion.space"
railway variables set LANDING_URL="https://outlivion.space"
railway variables set DASHBOARD_URL="https://dashboard.outlivion.space"
railway variables set LOG_LEVEL=info
```

## После добавления переменных

1. Railway автоматически перезапустит деплой
2. Проверь логи: **Deployments** → выбери последний деплой → **View Logs**
3. Должно быть: `Server started on port 3001`
4. Проверь API: `https://your-railway-app.up.railway.app/health`

## Обновление домена

После успешного деплоя:

1. В Railway Dashboard → **Settings** → **Networking**
2. Добавь кастомный домен: `api.outlivion.space`
3. Railway даст DNS записи для настройки
4. Добавь CNAME запись в DNS провайдере

