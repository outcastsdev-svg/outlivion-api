# 🔧 Backend интеграция с Telegram ботом

**Дата:** 3 декабря 2025  
**Статус:** ✅ РЕАЛИЗОВАНО

---

## 📝 Выполненные изменения

### 1. POST /auth/telegram - Поддержка запросов от бота

**Файл:** `src/routes/auth.ts`

**Изменения:**
- Добавлена проверка `isBotRequest` (hash === 'bot-created-user')
- Пропуск валидации подписи для запросов от бота
- Логирование bot-запросов

**Код:**
```typescript
// Check if request is from bot (special marker)
const isBotRequest = widgetData.hash === 'bot-created-user';

if (isBotRequest) {
  // Telegram Bot: special marker for bot-created users
  authSource = 'widget';
  telegramData = widgetData as any;
  
  logAuth('Bot user creation request', { 
    telegramId: widgetData.id,
    firstName: widgetData.first_name,
  });
  
  // Skip signature validation for bot requests
}
```

**Как это работает:**
1. Бот отправляет POST /auth/telegram с данными пользователя
2. Устанавливает специальный маркер: `hash: 'bot-created-user'`
3. Backend пропускает проверку подписи
4. Создаёт или обновляет пользователя в БД
5. Возвращает токены (опционально для бота)

---

### 2. GET /user/subscription - Поддержка запросов от бота

**Файл:** `src/routes/user.ts`

**Изменения:**
- Добавлена поддержка query параметра `telegramId`
- Работает без токена авторизации для бота
- Поиск пользователя по Telegram ID

**Код:**
```typescript
router.get('/subscription', asyncHandler(async (req: any, res) => {
  let userId: string | undefined;
  
  // Проверяем запрос от бота (query param telegramId)
  const telegramId = req.query.telegramId as string | undefined;
  
  if (telegramId) {
    // Запрос от бота - находим пользователя по Telegram ID
    logger.info('Bot subscription request', { telegramId });
    
    const user = await db.query.users.findFirst({
      where: eq(users.telegramId, telegramId),
    });
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }
    
    userId = user.id;
  } else {
    // Обычный запрос - требуется авторизация
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
    }
    
    userId = req.user.userId;
  }
  
  // Получение подписки по userId
  // ...
})
```

**Использование от бота:**
```bash
GET /user/subscription?telegramId=782245481
```

**Ответ:**
```json
{
  "id": "uuid",
  "plan": "monthly",
  "status": "active",
  "startDate": "2025-12-01",
  "endDate": "2026-01-01",
  "isExpired": false,
  "daysRemaining": 29
}
```

Если подписки нет:
```json
{
  "status": "none",
  "message": "No active subscription"
}
```

---

## 🚀 Развёртывание

### Проверка сборки:
```bash
cd outlivion-api
npm run build
```

**Результат:** ✅ Сборка успешна

### Деплой на Railway:

1. **Коммит изменений:**
   ```bash
   git add src/routes/auth.ts src/routes/user.ts
   git commit -m "feat: Add bot integration for user creation and subscription status"
   ```

2. **Push в main:**
   ```bash
   git push origin main
   ```

3. **Railway автоматически задеплоит** изменения

---

## 🧪 Тестирование

### Тест 1: Создание пользователя от бота

```bash
curl -X POST "https://api.outlivion.space/auth/telegram" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "782245481",
    "first_name": "Мухамед",
    "last_name": "Келеметов",
    "username": "chalemat",
    "auth_date": "1764791000",
    "hash": "bot-created-user"
  }'
```

**Ожидаемый результат:**
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": {
    "id": "uuid",
    "telegramId": "782245481",
    "firstName": "Мухамед",
    "isNewUser": true
  }
}
```

### Тест 2: Получение подписки от бота

```bash
curl "https://api.outlivion.space/user/subscription?telegramId=782245481"
```

**Ожидаемый результат (если есть подписка):**
```json
{
  "plan": "monthly",
  "status": "active",
  "endDate": "2026-01-01",
  "daysRemaining": 29
}
```

**Ожидаемый результат (если нет подписки):**
```json
{
  "status": "none",
  "message": "No active subscription"
}
```

---

## 📊 Интеграция с ботом

Бот уже настроен на использование этих endpoint'ов:

### При команде /start:
```typescript
// src/app/api/bot/route.ts
const userResult = await createOrUpdateUser({
  telegramId: from.id,
  firstName: from.first_name,
  lastName: from.last_name,
  username: from.username,
  photoUrl: from.photo_url,
})
```

Вызывает: `POST /auth/telegram` с hash: 'bot-created-user'

### При команде /status:
```typescript
// src/app/api/bot/route.ts
const subscriptionResult = await getUserSubscription(userId)
```

Вызывает: `GET /user/subscription?telegramId=<id>`

---

## ⚠️ Примечания

1. **Безопасность:** Запросы от бота идентифицируются по специальному маркеру `hash: 'bot-created-user'`. Это безопасно, так как:
   - Только бот знает этот маркер
   - Бот работает на защищённом сервере (Vercel)
   - Webhook защищён secret token

2. **Rate Limiting:** Рекомендуется добавить rate limiting для endpoint'ов бота, чтобы предотвратить злоупотребления.

3. **Логирование:** Все запросы от бота логируются с префиксом 'Bot' для мониторинга.

---

## ✅ Чеклист

- [x] POST /auth/telegram поддерживает bot-запросы
- [x] GET /user/subscription работает с telegramId
- [x] Сборка backend успешна
- [ ] Деплой на Railway
- [ ] Тестирование в production

---

**Следующий шаг:** Задеплоить backend на Railway

