import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Verify that a user_id exists and is active in the profiles table
 * This provides basic authorization for edge functions in the custom Telegram auth system
 */
export async function verifyUser(userId: string | null | undefined): Promise<{
  valid: boolean;
  profile?: { id: string; telegram_id: string; name: string; active: boolean };
  error?: string;
}> {
  if (!userId || typeof userId !== 'string') {
    return { valid: false, error: 'User ID is required' };
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    return { valid: false, error: 'Invalid user ID format' };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return { valid: false, error: 'Server configuration error' };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, telegram_id, name, active")
    .eq("id", userId)
    .eq("active", true)
    .single();

  if (error || !profile) {
    return { valid: false, error: 'Unauthorized: User not found or inactive' };
  }

  return { valid: true, profile };
}

/**
 * Verify that a user has a specific role
 */
export async function verifyUserRole(
  userId: string,
  requiredRole: 'admin' | 'user'
): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return false;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", requiredRole)
    .single();

  return !!data;
}

/**
 * Verify task ownership or authorship
 */
export async function verifyTaskAccess(
  userId: string,
  taskId: string
): Promise<{ hasAccess: boolean; isOwner: boolean; isAuthor: boolean }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return { hasAccess: false, isOwner: false, isAuthor: false };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: task } = await supabase
    .from("tasks")
    .select("owner_id, author_id")
    .eq("id", taskId)
    .single();

  if (!task) {
    return { hasAccess: false, isOwner: false, isAuthor: false };
  }

  const isOwner = task.owner_id === userId;
  const isAuthor = task.author_id === userId;

  return {
    hasAccess: isOwner || isAuthor,
    isOwner,
    isAuthor,
  };
}
