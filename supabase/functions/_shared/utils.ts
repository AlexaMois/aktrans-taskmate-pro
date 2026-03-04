/**
 * Shared utilities for Supabase Edge Functions
 * АКТРАНС TaskMate Pro
 */

// =============================================================================
// CORS HEADERS
// =============================================================================

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

/**
 * Returns CORS preflight response
 */
export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  return null;
}

// =============================================================================
// RESPONSES
// =============================================================================

/**
 * Returns a successful JSON response
 */
export function successResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Returns an error JSON response and logs to console
 */
export function errorResponse(message: string, status = 500, details?: unknown): Response {
  console.error(`[ERROR] ${message}`, details ?? "");
  return new Response(JSON.stringify({ error: message, details }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// =============================================================================
// DATETIME - КРАСНОЯРСК (UTC+7)
// =============================================================================

const KRASNOYARSK_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Returns current date string (YYYY-MM-DD) in Krasnoyarsk timezone (UTC+7)
 */
export function todayKrasnoyarsk(): string {
  return new Date(Date.now() + KRASNOYARSK_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Converts a UTC ISO string to Krasnoyarsk date string (YYYY-MM-DD)
 */
export function toKrasnoyarskDate(utcIsoString: string): string {
  return new Date(new Date(utcIsoString).getTime() + KRASNOYARSK_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

/**
 * Returns current Krasnoyarsk hour (0-23)
 */
export function krasnoyarskHour(): number {
  return (new Date().getUTCHours() + 7) % 24;
}

/**
 * Returns true if current Krasnoyarsk time is within working hours (08:00-20:00)
 */
export function isWorkingHours(): boolean {
  const hour = krasnoyarskHour();
  return hour >= 8 && hour < 20;
}

/**
 * Returns ISO string of N hours ago
 */
export function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 60 * 60 * 1000).toISOString();
}

// =============================================================================
// TELEGRAM API
// =============================================================================

const TELEGRAM_API_BASE = "https://api.telegram.org";

/**
 * Sends a Telegram message with HTML formatting
 * Returns true on success
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string | number,
  text: string,
  options?: {
    parseMode?: "HTML" | "Markdown" | "MarkdownV2";
    replyMarkup?: unknown;
    disableNotification?: boolean;
  }
): Promise<boolean> {
  try {
    const response = await fetch(
      `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: sanitizeHtml(text),
          parse_mode: options?.parseMode ?? "HTML",
          reply_markup: options?.replyMarkup,
          disable_notification: options?.disableNotification ?? false,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error(`[Telegram] Failed to send message to ${chatId}: ${err}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[Telegram] Exception sending message to ${chatId}:`, e);
    return false;
  }
}

/**
 * Sends admin alert when a critical error occurs
 */
export async function sendAdminAlert(
  botToken: string,
  adminChatId: string,
  functionName: string,
  error: unknown
): Promise<void> {
  const message = [
    `⚠️ <b>KRITICHESKAYA OSHIBKA</b>`,
    `🔧 Funktsiya: <code>${functionName}</code>`,
    `📅 Vremya: ${new Date().toISOString()}`,
    `❌ Oshibka: <code>${String(error).slice(0, 500)}</code>`,
  ].join("\n");

  await sendTelegramMessage(botToken, adminChatId, message);
}

// =============================================================================
// TEXT SANITIZATION
// =============================================================================

/**
 * Escapes HTML special characters for safe use in Telegram HTML mode
 */
export function sanitizeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Truncates text to maxLength with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

// =============================================================================
// ENVIRONMENT
// =============================================================================

/**
 * Gets required environment variable, throws if missing
 */
export function requireEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Gets optional environment variable with default
 */
export function getEnv(key: string, defaultValue = ""): string {
  return Deno.env.get(key) ?? defaultValue;
}

// =============================================================================
// LOGGING
// =============================================================================

export type LogLevel = "info" | "warn" | "error" | "debug";

/**
 * Structured logger for Edge Functions
 */
export function log(level: LogLevel, message: string, data?: unknown): void {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    data,
  };
  if (level === "error" || level === "warn") {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}
