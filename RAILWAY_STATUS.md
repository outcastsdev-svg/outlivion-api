# ✅ Railway Backend - Current Status

**Project:** https://railway.com/project/4345835b-c579-4146-96b4-025875b9f3de  
**Service:** outlivion-backend  
**Domain:** https://api.outlivion.space

---

## ✅ ЧТО УЖЕ НАСТРОЕНО:

### Environment Variables: ✅ ALMOST COMPLETE

```
✅ DATABASE_URL             → Neon PostgreSQL
✅ TELEGRAM_BOT_TOKEN       → Configured
✅ JWT_SECRET               → Set
✅ NODE_ENV                 → production
✅ PORT                     → 3001
✅ RAILWAY_PUBLIC_DOMAIN    → api.outlivion.space

⚠️  JWT_REFRESH_SECRET      → НУЖНО ДОБАВИТЬ
⚠️  ALLOW_MOCK_AUTH         → НУЖНО ДОБАВИТЬ (false)
```

### Domains: ✅ CONFIGURED
```
✅ Public Domain:  api.outlivion.space
✅ Internal:       outlivion-backend.railway.internal
```

### URLs Configured:
```
✅ DASHBOARD_URL:  https://dashboard.outlivion.space
✅ FRONTEND_URL:   https://portal.outlivion.space
✅ MINIAPP_URL:    https://app.outlivion.space  ← OUR NEW APP!
✅ LANDING_URL:    https://outlivion.space
✅ PORTAL_URL:     https://portal.outlivion.space
```

---

## 🔧 НУЖНО ДОБАВИТЬ (2 переменные):

### Команды:

```bash
cd /Users/kelemetovmuhamed/Documents/outlivion-new/outlivion-api

# 1. Добавить JWT_REFRESH_SECRET
railway variables set JWT_REFRESH_SECRET "GENERATED_SECRET_BELOW"

# 2. Отключить mock auth
railway variables set ALLOW_MOCK_AUTH "false"
```

**Generated JWT_REFRESH_SECRET (используй это):**
```
Смотри output команды выше ↑
```

---

## 🚀 DEPLOYMENT:

После добавления переменных:

```bash
# Deploy backend
cd /Users/kelemetovmuhamed/Documents/outlivion-new/outlivion-api
railway up

# Check status
railway status

# View logs
railway logs
```

---

## ✅ ПОСЛЕ DEPLOYMENT:

### Update Frontend Environment:

```bash
cd /Users/kelemetovmuhamed/Documents/outlivion-new/outlivion-miniapp

# Update API URL to Railway domain
vercel env rm NEXT_PUBLIC_API_URL production  # Remove old
vercel env add NEXT_PUBLIC_API_URL production
# Enter: https://api.outlivion.space

# Redeploy
vercel --prod
```

---

## 🧪 TESTING:

```bash
# Backend health
curl https://api.outlivion.space/health

# Tariffs endpoint
curl https://api.outlivion.space/billing/tariffs

# Should return JSON with tariffs
```

---

## 📊 INTEGRATION STATUS:

```
Frontend:  ✅ DEPLOYED (app.outlivion.space)
Backend:   ⏳ Ready to deploy (2 vars + railway up)
Database:  ✅ Neon PostgreSQL configured
Domain:    ✅ api.outlivion.space ready

Time to complete: ~5 минут
```

---

**Railway Project:** https://railway.com/project/4345835b-c579-4146-96b4-025875b9f3de  
**Status:** ✅ Almost ready (add 2 vars + deploy)

