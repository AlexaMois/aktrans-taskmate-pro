# Meetings Bot — Telegram бот для стенограмм совещаний

**Telegram бот для сбора стенограмм совещаний с автоматической сводкой за день через Perplexity AI**

## 🎯 Что делает бот

- Принимает файлы стенограмм (`.txt`) через Telegram
- Сохраняет их в Google Sheets с датой и временем
- По команде `/сводка` (или кнопке 📊) генерирует итоговую сводку за день через Perplexity AI
- Имеет удобные кнопки для работы с телефона

## 📋 Текущее состояние

✅ **Рабочая версия кода находится в Supabase Edge Functions**  
⚠️ **GitHub код отстал от актуальной версии** — требуется синхронизация

---

## 🔄 Синхронизация кода: Supabase → GitHub

### Зачем это нужно?

Сейчас код в двух местах:
- **Supabase** (актуальный рабочий код) ← бот работает отсюда
- **GitHub** (старая версия) ← вы редактируете здесь

Чтобы всегда редактировать в GitHub и автоматически деплоить в Supabase, нужно:

### Шаг 1: Скачать финальный код из Supabase

1. Откройте [Supabase Code Editor](https://supabase.com/dashboard/project/hvsighjpcycwoqpmuvga/functions/meetings-bot/code)
2. Нажмите кнопку **Download** вверху страницы
3. Распакуйте ZIP — внутри файлы `index.ts` и `googleAuth.ts`

### Шаг 2: Загрузить в GitHub

1. Откройте файл [`supabase/functions/meetings-bot/index.ts`](https://github.com/AlexaMois/aktrans-taskmate-pro/edit/main/supabase/functions/meetings-bot/index.ts) в GitHub
2. Скопируйте содержимое из скачанного `index.ts`
3. Вставьте в редактор GitHub (Ctrl+A → Вставить)
4. **Commit changes** с сообщением `"sync: актуализация кода из Supabase"`
5. Аналогично для `googleAuth.ts`

---

## ⚙️ Настройка GitHub Actions (автодеплой)

ГитHub Actions уже настроен! При каждом push в `main` бот автоматически деплоится в Supabase.

### ✅ Что уже сделано:

- Создан workflow `.github/workflows/deploy-supabase.yml`
- Настроен триггер на изменения в `supabase/functions/**`

### ⚠️ Требуется: добавить секрет `SUPABASE_ACCESS_TOKEN`

1. Перейдите в [Supabase Account → Access Tokens](https://supabase.com/dashboard/account/tokens)
2. Создайте новый Personal Access Token:
   - Name: `GitHub Actions Deploy`
   - Scopes: выберите `all` или минимум `functions.write`
3. Скопируйте токен
4. Добавьте его в GitHub:
   - Откройте [Settings → Secrets and variables → Actions](https://github.com/AlexaMois/aktrans-taskmate-pro/settings/secrets/actions)
   - **New repository secret**
   - Name: `SUPABASE_ACCESS_TOKEN`
   - Value: ваш токен
5. **Save secret**

### ✅ Готово! Теперь при каждом push код автоматически деплоится

---

## 📝 Как редактировать код

### Вариант 1: Через GitHub веб-интерфейс (рекомендуется для быстрых правок)

1. Откройте файл [`supabase/functions/meetings-bot/index.ts`](https://github.com/AlexaMois/aktrans-taskmate-pro/blob/main/supabase/functions/meetings-bot/index.ts)
2. Нажмите кнопку **✏️ Edit** (карандаш справа вверху)
3. Внесите изменения
4. **Commit changes** → введите описание → **Commit**
5. GitHub Actions автоматически задеплоит код в Supabase
6. Через ~2 минуты проверьте бота — изменения применены

### Вариант 2: Через GitHub.dev (полноценный VS Code в браузере)

1. На главной странице репозитория нажмите `.` (точка) на клавиатуре
2. Откроется VS Code в браузере
3. Редактируйте файлы как обычно
4. Commit через Source Control (Ctrl+Shift+G)
5. Push → автодеплой через GitHub Actions

### Вариант 3: Локально (если нужна полная IDE)

```bash
# Клонируйте репозиторий
git clone https://github.com/AlexaMois/aktrans-taskmate-pro.git
cd aktrans-taskmate-pro

# Редактируйте файлы в VS Code / любой IDE
# Коммит и push
git add .
git commit -m "описание изменений"
git push origin main

# GitHub Actions автоматически задеплоит
```

---

## 🔐 Секреты Supabase

Все секреты (токены, ключи) хранятся в Supabase и **не нужно хранить в GitHub**.

### Текущие секреты:

| Секрет | Назначение |
|--------|------------|
| `TELEGRAM_BOT_TOKEN` | Токен Telegram бота (@akts_tasks_bot) |
| `GOOGLE_SHEET_ID` | ID Google Sheets таблицы "Meetings Bot" |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | JSON ключ Google Service Account |
| `PERPLEXITY_API_KEY` | API ключ Perplexity для генерации сводок |

### Где редактировать секреты:

👉 [Supabase → Edge Functions → Secrets](https://supabase.com/dashboard/project/hvsighjpcycwoqpmuvga/functions/secrets)

---

## 📚 Структура проекта

```
aktrans-taskmate-pro/
├── .github/
│   └── workflows/
│       └── deploy-supabase.yml     # GitHub Actions автодеплой
├── supabase/
│   └── functions/
│       └── meetings-bot/
│           ├── index.ts            # Основной код бота
│           └── googleAuth.ts       # Google Sheets авторизация
└── README.md                       # Этот файл
```

---

## 🚀 Быстрый старт после синхронизации

1. ✅ Скачайте финальный код из Supabase (кнопка Download)
2. ✅ Загрузите в GitHub (`index.ts` + `googleAuth.ts`)
3. ✅ Добавьте `SUPABASE_ACCESS_TOKEN` в GitHub Secrets
4. ✅ Готово! Теперь редактируйте в GitHub → автодеплой в Supabase

---

## 📞 Telegram бот

🤖 **[@akts_tasks_bot](https://t.me/akts_tasks_bot)**

### Команды:
- `/start` — приветствие и инструкции
- `/сводка` (или кнопка 📊) — сводка за сегодня
- `/помощь` (или кнопка ℹ️) — справка

### Использование:
1. Отправьте `.txt` файл со стенограммой совещания
2. Бот сохранит в Google Sheets
3. В конце дня нажмите кнопку **📊 Сводка за день**
4. Perplexity AI сгенерирует итоговый анализ

---

## 🛠️ Технологии

- **Backend**: Supabase Edge Functions (Deno)
- **AI**: Perplexity API (модель `sonar`)
- **Storage**: Google Sheets API
- **CI/CD**: GitHub Actions
- **Bot**: Telegram Bot API

---

## 📊 Логи и мониторинг

- [Supabase Logs](https://supabase.com/dashboard/project/hvsighjpcycwoqpmuvga/functions/meetings-bot/logs)
- [GitHub Actions](https://github.com/AlexaMois/aktrans-taskmate-pro/actions)
- [Google Sheets (Meetings Bot)](https://docs.google.com/spreadsheets/d/1aBaMB_OowtvnL1leMMlHat0XoacpjoKwYcO9tfk64Cc)

---

**Автор**: AlexaMois  
**Проект**: aktrans-taskmate-pro  
**Лицензия**: Private
