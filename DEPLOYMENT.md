# Инструкции по развертыванию (Deployment)

## Содержание
1. [Автоматический деплой (CI/CD)](#автоматический-деплой-cicd)
2. [Ручной деплой](#ручной-деплой)
3. [Проверка перед релизом](#проверка-перед-релизом)
4. [Процедура отката (Rollback)](#процедура-отката-rollback)

---

## Автоматический деплой (CI/CD)

В проекте настроены GitHub Actions для автоматического деплоя.

### Edge Functions
Деплоятся автоматически при push в ветку `main`, если изменены файлы в `supabase/functions/**`.
**Требуемые секреты в GitHub Repo:**
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`

### Frontend (Lovable / Vercel)
Деплоится автоматически при push в `main`. Статус можно проверить в панели Lovable.dev или Vercel.

---

## Ручной деплой

Используйте этот метод только в исключительных случаях.

### Edge Functions
```bash
# Деплой конкретной функции
supabase functions deploy name-of-function --project-ref your-project-id

# Деплой всех функций
supabase functions deploy --project-ref your-project-id
```

### База данных (Миграции)
```bash
supabase db push --project-ref your-project-id
```

---

## Проверка перед релизом

Перед слиянием в `main` проверьте:
1. **Edge Functions**:
   - `supabase functions serve` — локальный запуск без ошибок.
   - Тестовый вызов через `curl`.
2. **База данных**:
   - Миграции созданы через `supabase migration new`.
   - SQL скрипты не содержат деструктивных действий без бэкапа.
3. **Frontend**:
   - `bun run build` завершается успешно.
   - Отсутствуют ошибки TypeScript.

---

## Процедура отката (Rollback)

### Edge Functions
Supabase не поддерживает встроенный откат версий функций. Для отката:
1. Выполните `git revert` нужного коммита в `main`.
2. Дождитесь завершения GitHub Action или запустите ручной деплой из стабильной ветки.

### База данных
1. Используйте бэкап Supabase (Dashboard -> Settings -> Database -> Backups).
2. Для мелких правок используйте "down" миграции, если они были подготовлены.

### Frontend
В панели управления деплоем (Vercel/Lovable) выберите предыдущий успешный деплой и нажмите "Redeploy" или "Promote to Production".

---

## Мониторинг после деплоя
После деплоя проверьте логи в Supabase Dashboard:
`Functions -> [Имя функции] -> Logs`

Критичные ошибки также приходят в Telegram админам (если настроено в `_shared/utils.ts`).