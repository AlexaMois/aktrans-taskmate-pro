-- Re-enable RLS on tasks with proper bypassing policy
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- The existing policies should work for anon role since we set TO anon, authenticated
-- But let's verify by checking if FORCE ROW LEVEL SECURITY is needed
-- Actually, for Telegram auth, we need a more permissive approach

-- Drop all existing policies and recreate with simpler approach
DROP POLICY IF EXISTS "Anyone can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Anyone can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Anyone can delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "Anyone can view common tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view their personal tasks" ON public.tasks;

-- Create simple permissive policies for all operations
CREATE POLICY "Allow all operations on tasks"
ON public.tasks
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);