# API Документация

## 📚 Оглавление

1. [Edge Functions](#edge-functions)
2. [База данных](#база-данных)
3. [Секреты](#секреты)
4. [Webhook API](#webhook-api)

---

## 🚀 Edge Functions

### 1. meetings-bot
**Endpoint**: `https://hvsighjpcycwoqpmuvga.supabase.co/functions/v1/meetings-bot`  
**Метод**: `POST`  
**Описание**: Telegram webhook для обработки стенограмм совещаний

**Request Body**:
```json
{
  "message": {
    "from": { "id": 123456789, "first_name": "Имя" },
    "text": "/сводка",
    "document": {
      "file_id": "...",
      "file_name": "meeting.txt"
    }
  }
}
```

**Команды**:
- `/start` - Приветствие
- `/сводка` или кнопка 📊 - Сводка за день
- `/помощь` или кнопка ℹ️ - Справка
- Отправка .txt файла - Сохранение стенограммы

**Response**:
```json
{
  "ok": true,
  "message": "Стенограмма сохранена"
}
```

**Интеграции**: Telegram Bot API, Google Sheets, Perplexity AI

---

### 2. personal-task-reminder
**Endpoint**: `https://hvsighjpcycwoqpmuvga.supabase.co/functions/v1/personal-task-reminder`  
**Метод**: `POST` (GitHub Actions cron)  
**Описание**: Напоминания о просроченных задачах

**Логика**:
```typescript
- Проверяет задачи со статусом != 'done'
- Дедлайн < текущая дата
- Рабочие часы: 08:00-20:00 (UTC+7)
- Throttle: макс 1 напоминание / 24 часа
```

**Response**:
```json
{
  "reminders_sent": 3,
  "tasks": [1, 5, 12]
}
```

---

### 3. daily-summary
**Endpoint**: `https://hvsighjpcycwoqpmuvga.supabase.co/functions/v1/daily-summary`  
**Метод**: `POST` (GitHub Actions cron 22:00)  
**Описание**: Дневная сводка задач через AI

**AI Model**: Perplexity `sonar-pro`

**Response**:
```json
{
  "summary": "# Сводка за день...",
  "tasks_count": 15,
  "completed": 8
}

```

---

### 4. send-telegram-notification
**Endpoint**: `https://hvsighjpcycwoqpmuvga.supabase.co/functions/v1/send-telegram-notification`  
**Метод**: `POST`  
**Описание**: Отправка произвольных уведомлений

**Request**:
```json
{
  "telegram_id": 123456789,
  "message": "Текст уведомления"
}
```

---

### 5. sync-sheets
**Endpoint**: `https://hvsighjpcycwoqpmuvga.supabase.co/functions/v1/sync-sheets`  
**Метод**: `POST`  
**Описание**: Синхронизация Supabase → Google Sheets

---

## 📦 База данных

### Таблицы

#### `profiles`
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  telegram_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `tasks`
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES profiles(id),
  due_date DATE,
  status task_status DEFAULT 'backlog',
  priority task_priority DEFAULT 'normal',
  last_reminded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Enum Types**:
- `task_status`: backlog, in_progress, review, done
- `task_priority`: normal, urgent
- `app_role`: admin, user

#### `attachments`
```sql
CREATE TABLE attachments (
  id UUID PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  file_name TEXT,
  file_url TEXT,
  file_type TEXT,
  uploaded_by UUID REFERENCES profiles(id)
);
```

### Индексы
```sql
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_last_reminded ON tasks(last_reminded_at);
```

### RLS Политики
```sql
-- Чтение всех задач
CREATE POLICY "tasks_select" ON tasks FOR SELECT
  TO authenticated USING (true);

-- Создание только админам
CREATE POLICY "tasks_insert" ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );
```

---

## 🔐 Секреты

**Где хранятся**: Supabase Edge Functions Secrets

| Секрет | Назначение |
|---------|------------|
| `TELEGRAM_BOT_TOKEN` | @akts_tasks_bot |
| `GOOGLE_SHEET_ID` | Таблица Meetings Bot |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | JSON ключ Google |
| `PERPLEXITY_API_KEY` | AI генерация |
| `SUPABASE_ACCESS_TOKEN` | GitHub Actions deploy |

**Добавить**: https://supabase.com/dashboard/project/hvsighjpcycwoqpmuvga/functions/secrets

---

## 🔗 Webhook API

### Telegram Webhook Setup
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://hvsighjpcycwoqpmuvga.supabase.co/functions/v1/meetings-bot"
  }'
```

---

## 🛠️ Разработка

### Тестирование локально
```bash
supabase functions serve personal-task-reminder --env-file .env.local

curl -X POST http://localhost:54321/functions/v1/personal-task-reminder
```

### Деплой
```bash
supabase functions deploy personal-task-reminder
```
