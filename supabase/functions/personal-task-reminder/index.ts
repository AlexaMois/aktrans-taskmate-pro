import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml } from "../_shared/validation.ts";

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

    // ── Проверяем рабочие часы (08:00–20:00 по Красноярску UTC+7) ──────────
    const nowUtc = new Date();
    const krasnoyarskHour = (nowUtc.getUTCHours() + 7) % 24;
    if (krasnoyarskHour < 8 || krasnoyarskHour >= 20) {
      console.log(`Outside working hours (Krasnoyarsk hour: ${krasnoyarskHour}). Skipping reminders.`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "outside working hours" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Берём незавершённые личные задачи старше 24 часов ──────────────────
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select(`
        id,
        title,
        status,
        created_at,
        last_reminded_at,
        owner_id,
        owner:profiles!tasks_owner_id_fkey(telegram_id, name)
      `)
      .eq("scope", "personal")
      .neq("status", "done")
      .lt("created_at", twentyFourHoursAgo)
              .or(`last_reminded_at.is.null,last_reminded_at.lt.${twentyFourHoursAgo}`)
      .returns<Array<{
        id: string;
        title: string;
        status: string;
        created_at: string;
        last_reminded_at: string | null;
        owner_id: string;
        owner: { telegram_id: string; name: string } | null;
      }>>();

    if (tasksError) {
      throw new Error(`Failed to fetch tasks: ${tasksError.message}`);
    }

    console.log(`Found ${tasks?.length || 0} personal tasks older than 24h`);

    // ── Фильтруем: не напоминали сегодня ───────────────────────────────────
      const todayStr = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10); // YYYY-MM-DD Krasnoyarsk (UTC+7)
    const tasksToRemind = (tasks || []).filter((task) => {
      if (!task.owner?.telegram_id) return false;
      if (!task.last_reminded_at) return true; // никогда не напоминали
            const lastDate = new Date(new Date(task.last_reminded_at).getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10); // Krasnoyarsk date
      return lastDate < todayStr; // последнее напоминание было до сегодня
    });

    console.log(`Tasks to remind today: ${tasksToRemind.length}`);

    const notifications: { taskId: string; success: boolean; error?: string }[] = [];

    for (const task of tasksToRemind) {
      const hoursAgo = Math.floor(
        (Date.now() - new Date(task.created_at).getTime()) / (1000 * 60 * 60)
      );

      const safeTitle = escapeHtml(task.title);
      const text =
        `⏰ <b>Напоминание о личной задаче</b>\n\n` +
        `📝 ${safeTitle}\n` +
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
              telegram_id: task.owner!.telegram_id,
              text,
              parse_mode: "HTML",
            }),
          }
        );

        const notifyResult = await notifyResponse.json();

        if (notifyResponse.ok && notifyResult.success) {
          console.log(`Reminder sent for task ${task.id} to ${task.owner!.telegram_id}`);

          // ── Обновляем last_reminded_at ────────────────────────────────────
          const { error: updateError } = await supabase
            .from("tasks")
            .update({ last_reminded_at: new Date().toISOString() })
            .eq("id", task.id);

          if (updateError) {
            console.warn(`Could not update last_reminded_at for task ${task.id}:`, updateError.message);
          }

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
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: tasksToRemind.length,
        skippedAlreadyRemindedToday: (tasks?.length || 0) - tasksToRemind.length,
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