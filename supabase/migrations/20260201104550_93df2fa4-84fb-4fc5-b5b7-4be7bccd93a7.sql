-- Create app role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create task status enum
CREATE TYPE public.task_status AS ENUM ('backlog', 'in_progress', 'review', 'done');

-- Create task priority enum
CREATE TYPE public.task_priority AS ENUM ('normal', 'urgent');

-- Create profiles table for user data (linked to Telegram ID)
CREATE TABLE public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    telegram_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    UNIQUE (user_id, role)
);

-- Create tasks table
CREATE TABLE public.tasks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status task_status NOT NULL DEFAULT 'backlog',
    priority task_priority NOT NULL DEFAULT 'normal',
    owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create comments table
CREATE TABLE public.comments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task history table
CREATE TABLE public.task_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    action TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create attachments table for files and links
CREATE TABLE public.attachments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('file', 'link')),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- Since we're using Telegram ID auth (not Supabase auth), 
-- we'll use permissive policies and handle auth in the application layer
-- The app validates Telegram ID against profiles table

-- Profiles policies (public read for active users, managed by edge functions)
CREATE POLICY "Anyone can view active profiles"
ON public.profiles FOR SELECT
USING (active = true);

-- User roles policies
CREATE POLICY "Anyone can view user roles"
ON public.user_roles FOR SELECT
USING (true);

-- Tasks policies (all authenticated app users can read tasks)
CREATE POLICY "Anyone can view tasks"
ON public.tasks FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert tasks"
ON public.tasks FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update tasks"
ON public.tasks FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete tasks"
ON public.tasks FOR DELETE
USING (true);

-- Comments policies
CREATE POLICY "Anyone can view comments"
ON public.comments FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert comments"
ON public.comments FOR INSERT
WITH CHECK (true);

-- Task history policies
CREATE POLICY "Anyone can view task history"
ON public.task_history FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert task history"
ON public.task_history FOR INSERT
WITH CHECK (true);

-- Attachments policies
CREATE POLICY "Anyone can view attachments"
ON public.attachments FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert attachments"
ON public.attachments FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can delete attachments"
ON public.attachments FOR DELETE
USING (true);

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Create function to get user by telegram_id
CREATE OR REPLACE FUNCTION public.get_user_by_telegram_id(_telegram_id text)
RETURNS TABLE (
    id uuid,
    telegram_id text,
    name text,
    active boolean,
    role app_role
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        p.id,
        p.telegram_id,
        p.name,
        p.active,
        ur.role
    FROM public.profiles p
    LEFT JOIN public.user_roles ur ON p.id = ur.user_id
    WHERE p.telegram_id = _telegram_id
$$;