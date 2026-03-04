-- Migration: add last_reminded_at column to tasks table
-- This prevents hourly spam notifications by tracking when each task was last reminded

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMPTZ DEFAULT NULL;

-- Index for efficient querying of tasks that need reminders
CREATE INDEX IF NOT EXISTS idx_tasks_last_reminded_at
  ON tasks (last_reminded_at)
  WHERE status != 'done';