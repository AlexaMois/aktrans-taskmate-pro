-- Drop existing enum and create new ones
DROP TYPE IF EXISTS task_status CASCADE;
DROP TYPE IF EXISTS task_priority CASCADE;

-- Create new task_status enum with 5 values
CREATE TYPE task_status AS ENUM ('ideas', 'planned', 'in_progress', 'review', 'done');

-- Create task_scope enum
CREATE TYPE task_scope AS ENUM ('common', 'personal');

-- Recreate tasks table with new schema
DROP TABLE IF EXISTS attachments CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS task_history CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;

CREATE TABLE public.tasks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status task_status NOT NULL DEFAULT 'ideas',
    priority INTEGER NOT NULL DEFAULT 2 CHECK (priority >= 1 AND priority <= 3),
    scope task_scope NOT NULL DEFAULT 'common',
    author_id UUID NOT NULL REFERENCES public.profiles(id),
    owner_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies for tasks
CREATE POLICY "Anyone can view common tasks"
ON public.tasks FOR SELECT
USING (scope = 'common');

CREATE POLICY "Users can view their personal tasks"
ON public.tasks FOR SELECT
USING (scope = 'personal' AND owner_id IN (SELECT id FROM profiles WHERE telegram_id = current_setting('request.jwt.claims', true)::json->>'sub'));

CREATE POLICY "Anyone can insert tasks"
ON public.tasks FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update tasks"
ON public.tasks FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete tasks"
ON public.tasks FOR DELETE
USING (true);

-- Recreate task_history table
CREATE TABLE public.task_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    author_id UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view task history"
ON public.task_history FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert task history"
ON public.task_history FOR INSERT
WITH CHECK (true);

-- Recreate comments table
CREATE TABLE public.comments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id),
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments"
ON public.comments FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert comments"
ON public.comments FOR INSERT
WITH CHECK (true);

-- Recreate attachments table
CREATE TABLE public.attachments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view attachments"
ON public.attachments FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert attachments"
ON public.attachments FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can delete attachments"
ON public.attachments FOR DELETE
USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();