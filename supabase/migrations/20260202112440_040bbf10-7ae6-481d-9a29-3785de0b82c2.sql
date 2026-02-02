-- Drop the restrictive INSERT policy and create a permissive one
DROP POLICY IF EXISTS "Anyone can insert tasks" ON public.tasks;

CREATE POLICY "Anyone can insert tasks"
ON public.tasks
FOR INSERT
TO public
WITH CHECK (true);

-- Also fix the other restrictive policies
DROP POLICY IF EXISTS "Anyone can update tasks" ON public.tasks;

CREATE POLICY "Anyone can update tasks"
ON public.tasks
FOR UPDATE
TO public
USING (true);

DROP POLICY IF EXISTS "Anyone can delete tasks" ON public.tasks;

CREATE POLICY "Anyone can delete tasks"
ON public.tasks
FOR DELETE
TO public
USING (true);