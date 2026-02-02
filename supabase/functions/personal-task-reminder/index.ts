import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get personal tasks that are not done and created more than 24 hours ago
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select(`
        id,
        title,
        status,
        created_at,
        owner_id,
        owner:profiles!tasks_owner_id_fkey(telegram_id, name)
      `)
      .eq("scope", "personal")
      .neq("status", "done")
      .lt("created_at", twentyFourHoursAgo)
      .returns<Array<{
        id: string;
        title: string;
        status: string;
        created_at: string;
        owner_id: string;
        owner: { telegram_id: string; name: string } | null;
      }>>();

    if (tasksError) {
      throw new Error(`Failed to fetch tasks: ${tasksError.message}`);
    }

    console.log(`Found ${tasks?.length || 0} personal tasks older than 24h`);

    const notifications: { taskId: string; success: boolean; error?: string }[] = [];

    for (const task of tasks || []) {
      if (!task.owner?.telegram_id) {
        console.log(`Task ${task.id} has no owner with telegram_id, skipping`);
        continue;
      }

      const hoursAgo = Math.floor((Date.now() - new Date(task.created_at).getTime()) / (1000 * 60 * 60));
      
      const text = `⏰ <b>Напоминание о личной задаче</b>\n\n` +
        `📝 ${task.title}\n` +
        `⏱ Создана ${hoursAgo} ч. назад\n\n` +
        `Не забудьте выполнить задачу!`;

      try {
        const notifyResponse = await fetch(
          `${supabaseUrl}/functions/v1/send-telegram-notification`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              telegram_id: task.owner.telegram_id,
              text,
            }),
          }
        );

        const notifyResult = await notifyResponse.json();

        if (notifyResponse.ok && notifyResult.success) {
          console.log(`Reminder sent for task ${task.id} to ${task.owner.telegram_id}`);
          notifications.push({ taskId: task.id, success: true });
        } else {
          console.error(`Failed to send reminder for task ${task.id}:`, notifyResult);
          notifications.push({ taskId: task.id, success: false, error: notifyResult.error });
        }
      } catch (error) {
        console.error(`Error sending reminder for task ${task.id}:`, error);
        notifications.push({ 
          taskId: task.id, 
          success: false, 
          error: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: tasks?.length || 0,
        notifications,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Personal task reminder error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to process reminders";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
