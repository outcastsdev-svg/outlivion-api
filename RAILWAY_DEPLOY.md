# 🚀 Railway Deployment - Outlivion API

**Existing Project:** https://railway.com/project/4345835b-c579-4146-96b4-025875b9f3de

---

## ⚡ QUICK DEPLOY (5 минут)

### Step 1: Login
```bash
cd /Users/kelemetovmuhamed/Documents/outlivion-new/outlivion-api
railway login
# Откроется браузер - авторизуйся
```

### Step 2: Link к существующему проекту
```bash
railway link 4345835b-c579-4146-96b4-025875b9f3de
# или
railway link
# Выбери проект из списка
```

### Step 3: Проверь текущие переменные
```bash
railway variables
# Посмотри что уже настроено
```

### Step 4: Добавь недостающие переменные (если нужно)
```bash
# Проверь нужны ли эти:
railway variables set TELEGRAM_BOT_TOKEN "8477147639:AAEVS_D_A4avYXPOku78AWiYbiirOgglpbw"
railway variables set JWT_SECRET "твой_длинный_секрет_минимум_32_символа"
railway variables set JWT_REFRESH_SECRET "другой_длинный_секрет_32_символа"
railway variables set NODE_ENV "production"
railway variables set ALLOW_MOCK_AUTH "false"
railway variables set PORT "3001"
```

**Генерация секретов:**
```bash
# Генерируй 2 разных секрета:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Используй output для JWT_SECRET

node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Используй output для JWT_REFRESH_SECRET
```

### Step 5: Deploy!
```bash
railway up
# Backend задеплоится в ~2-3 минуты
```

### Step 6: Получи URL
```bash
railway domain
# Outputs: твой-url.up.railway.app
```

### Step 7: Run migrations (если нужно)
```bash
railway run npm run db:migrate
# или
railway shell
npm run db:migrate
```

---

## 🔧 Alternative: Railway Dashboard

**Web Interface:**
1. Go to https://railway.com/project/4345835b-c579-4146-96b4-025875b9f3de
2. Settings → Variables → Add all env vars
3. Deploy → Connect GitHub repo
4. Auto-deploy on push

---

## ✅ После Deployment

### Update Frontend:
```bash
cd /Users/kelemetovmuhamed/Documents/outlivion-new/outlivion-miniapp

# Set production API URL
vercel env add NEXT_PUBLIC_API_URL production
# Enter: https://твой-url.up.railway.app

# Redeploy
vercel --prod
```

### Test:
```bash
# Backend health
curl https://твой-url.up.railway.app/health

# Tariffs
curl https://твой-url.up.railway.app/billing/tariffs
```

---

## 🎯 Expected Results

После успешного deploy:

```
✅ Backend API: Running on Railway
✅ URL: https://твой-url.up.railway.app
✅ Database: Connected (Neon/Railway)
✅ Endpoints: All working
✅ Integration: Frontend ↔ Backend
```

---

## 📝 Quick Commands

```bash
# All-in-one deploy:
cd /Users/kelemetovmuhamed/Documents/outlivion-new/outlivion-api
railway login
railway link 4345835b-c579-4146-96b4-025875b9f3de
railway up

# Check status:
railway status
railway logs

# If issues:
railway variables  # Check env vars
railway logs       # Check errors
```

---

**Railway Project:** https://railway.com/project/4345835b-c579-4146-96b4-025875b9f3de  
**Time Estimate:** 5-10 минут  
**Status:** ✅ Ready to deploy

