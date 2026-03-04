-- Migration: add last_reminded_at column to tasks table

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- Таблица истории задач
CREATE TABLE IF NOT EXISTS task_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES profil
-- This prevents hourly spam notifications by tracking when each task was last reminded

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMPTZ DEFAULT NULL;

-- Index for efficient querying of tasks that need reminders
CREATE INDEX IF NOT EXISTS idx_tasks_last_reminded_at
  ON tasks (last_reminded_at)
  WHERE status != 'done';