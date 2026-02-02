-- Drop and recreate INSERT policy for proper roles
DROP POLICY IF EXISTS "Anyone can insert tasks" ON public.tasks;

CREATE POLICY "Anyone can insert tasks"
ON public.tasks
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Also update other policies
DROP POLICY IF EXISTS "Anyone can update tasks" ON public.tasks;

CREATE POLICY "Anyone can update tasks"
ON public.tasks
FOR UPDATE
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Anyone can delete tasks" ON public.tasks;

CREATE POLICY "Anyone can delete tasks"
ON public.tasks
FOR DELETE
TO anon, authenticated
USING (true);

-- Fix SELECT policies as well
DROP POLICY IF EXISTS "Anyone can view common tasks" ON public.tasks;

CREATE POLICY "Anyone can view common tasks"
ON public.tasks
FOR SELECT
TO anon, authenticated
USING (scope = 'common'::task_scope);

DROP POLICY IF EXISTS "Users can view their personal tasks" ON public.tasks;

CREATE POLICY "Users can view their personal tasks"
ON public.tasks
FOR SELECT
TO anon, authenticated
USING (
  (scope = 'personal'::task_scope) 
  AND (owner_id IN (
    SELECT profiles.id FROM profiles 
    WHERE profiles.telegram_id = (current_setting('request.jwt.claims'::text, true)::json ->> 'sub'::text)
  ))
);