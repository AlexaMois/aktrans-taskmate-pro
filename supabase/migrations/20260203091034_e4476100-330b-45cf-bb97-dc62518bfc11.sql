-- Add indexes on tasks table for better query performance
-- Index on scope for filtering common/personal tasks
CREATE INDEX IF NOT EXISTS idx_tasks_scope ON public.tasks(scope);

-- Index on owner_id for filtering tasks by owner
CREATE INDEX IF NOT EXISTS idx_tasks_owner_id ON public.tasks(owner_id);

-- Composite index for the most common query pattern: scope + owner_id
CREATE INDEX IF NOT EXISTS idx_tasks_scope_owner_id ON public.tasks(scope, owner_id);