# Руководство по участию в разработке

## Содержание
1. [Начало работы](#начало-работы)
2. [Структура проекта](#структура-проекта)
3. [Добавление новой Edge Function](#добавление-новой-edge-function)
4. [Code Style](#code-style)
5. [Процесс PR](#процесс-pr)

---

## Начало работы

### Требования
- Node.js 18+
- Bun (пакетный менеджер)
- Supabase CLI
- Доступ к репозиторию GitHub

### Локальный запуск
```bash
# Клонировать репозиторий
git clone https://github.com/AlexaMois/aktrans-taskmate-pro.git
cd aktrans-taskmate-pro

# Установить зависимости
bun install

# Запустить frontend
bun run dev

# Запустить Edge Function локально
supabase start
supabase functions serve personal-task-reminder --env-file .env.local
```

### Переменные окружения
Создайте файл `.env.local` для локальной разработки:
```env
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=your_local_key
TELEGRAM_BOT_TOKEN=your_bot_token
GOOGLE_SHEET_ID=your_sheet_id
PERPLEXITY_API_KEY=your_key
```

---

## Структура проекта
```
aktrans-taskmate-pro/
├── src/                    # React frontend
│   ├── components/         # UI компоненты
│   ├── contexts/           # React контексты
│   ├── hooks/              # Кастомные хуки
│   ├── pages/              # Страницы приложения
│   └── types/              # TypeScript типы
├── supabase/
│   ├── functions/          # Edge Functions (Deno)
│   │   ├── _shared/        # Общие утилиты
│   │   ├── meetings-bot/   # Telegram бот совещаний
│   │   ├── personal-task-reminder/  # Напоминания о задачах
│   │   ├── send-telegram-notification/
│   │   ├── sync-sheets/    # Синхронизация с Google Sheets
│   │   └── upload-file/
│   └── migrations/         # SQL миграции
└── docs/                   # Документация
    ├── API.md
    ├── ROADMAP.md
    └── GOOGLE_SHEETS_STRUCTURE.md
```

---

## Добавление новой Edge Function

1. Создать папку:
```bash
mkdir supabase/functions/my-function
```

2. Создать `index.ts`:
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { log } from "../_shared/utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Логика функции
    log("info", "my-function called");

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log("error", "my-function failed", { error: message });
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

3. Задокументировать в `docs/API.md`

4. Задеплоить:
```bash
supabase functions deploy my-function
```

---

## Code Style

### TypeScript / Deno (Edge Functions)
- Отступы: 2 пробела
- Всегда типизировать переменные и возвращаемые значения
- Использовать `const` по умолчанию
- Обворачивать всё в `try/catch`
- Использовать утилиты из `_shared/utils.ts`:
  - `log(level, message, data?)` — для логирования
  - `requireEnv(key)` — для обязательных env переменных
  - `getEnv(key, default)` — для опциональных

### React (Frontend)
- Функциональные компоненты с хуками
- Файлы компонентов: `PascalCase.tsx`
- Хуки: `use` prefix, `camelCase.ts`

---

## Процесс PR

1. Создать ветку от `main`:
```bash
git checkout -b feat/my-feature
```

2. Сделать изменения, следуя Code Style

3. Проверить что ничего не сломалось:
```bash
bun run build   # Frontend
supabase functions serve  # Edge Functions
```

4. Commit с понятным сообщением:
```
feat: добавлен новый функционал X
fix: исправлена ошибка Y
docs: обновлена документация Z
refactor: рефакторинг модуля W
```

5. Push и открыть PR в GitHub

6. В описании PR указать:
   - Что изменено
   - Как протестировано
   - Скриншоты (если UI изменения)

---

## Контакты

При вопросах — создайте Issue в репозитории.