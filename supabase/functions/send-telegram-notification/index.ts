import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { isValidTelegramId, escapeHtml, validateTextInput } from "../_shared/validation.ts";
import { verifyUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { telegram_id, text, user_id, safe_html } = body;

    // Validate telegram_id format
    if (!telegram_id) {
      return new Response(
        JSON.stringify({ error: "telegram_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isValidTelegramId(telegram_id)) {
      return new Response(
        JSON.stringify({ error: "Invalid telegram_id format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate text input
    const textValidation = validateTextInput(text, 4000);
    if (!textValidation.valid) {
      return new Response(
        JSON.stringify({ error: textValidation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If user_id provided, verify authorization
    // This is optional for backward compatibility, but recommended
    if (user_id) {
      const userVerification = await verifyUser(user_id);
      if (!userVerification.valid) {
        return new Response(
          JSON.stringify({ error: userVerification.error }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      throw new Error("TELEGRAM_BOT_TOKEN not configured");
    }

    // If safe_html is true, the caller has already formatted the HTML safely
    // Otherwise, we use the text as-is (caller is responsible for safety)
    const messageText = textValidation.value;

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegram_id,
          text: messageText,
          parse_mode: "HTML",
        }),
      }
    );

    const result = await response.json();

    if (!result.ok) {
      console.error("Telegram API error:", result);
      return new Response(
        JSON.stringify({ error: result.description || "Failed to send message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message_id: result.result.message_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Send notification error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send notification";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
