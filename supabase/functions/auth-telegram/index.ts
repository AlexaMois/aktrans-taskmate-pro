import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isValidTelegramId } from "../_shared/validation.ts";
import { getGoogleAccessToken } from "../_shared/googleAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GoogleSheetsResponse {
  values?: string[][];
}

interface UserData {
  telegram_id: string;
  name: string;
  role: "admin" | "user";
  active: boolean;
}

async function getUserFromGoogleSheet(telegramId: string): Promise<UserData | null> {
  const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
  const sheetId = Deno.env.get("GOOGLE_SHEET_ID");
  
  if (!serviceAccountKey || !sheetId) {
    console.error("Missing Google credentials");
    throw new Error("Google credentials not configured");
  }

  const accessToken = await getGoogleAccessToken(serviceAccountKey);
  
  // Fetch Users sheet - expecting columns: telegram_id, name, role, active
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Users!A:D`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Google Sheets API error:", errorText);
    throw new Error("Failed to fetch from Google Sheets");
  }

  const data: GoogleSheetsResponse = await response.json();
  
  if (!data.values || data.values.length < 2) {
    return null;
  }

  // Skip header row, find user by telegram_id
  for (let i = 1; i < data.values.length; i++) {
    const row = data.values[i];
    if (row[0] === telegramId) {
      return {
        telegram_id: row[0],
        name: row[1] || "Unknown",
        role: (row[2]?.toLowerCase() === "admin" ? "admin" : "user") as "admin" | "user",
        active: row[3]?.toLowerCase() === "true",
      };
    }
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { telegram_id } = await req.json();

    // Validate telegram_id is provided
    if (!telegram_id) {
      return new Response(
        JSON.stringify({ error: "Telegram ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate telegram_id format
    const telegramIdStr = telegram_id.toString().trim();
    if (!isValidTelegramId(telegramIdStr)) {
      return new Response(
        JSON.stringify({ error: "Invalid Telegram ID format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user from Google Sheet
    const userData = await getUserFromGoogleSheet(telegramIdStr);

    if (!userData) {
      return new Response(
        JSON.stringify({ error: "Нет доступа", code: "USER_NOT_FOUND" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!userData.active) {
      return new Response(
        JSON.stringify({ error: "Нет доступа", code: "USER_INACTIVE" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sync user to Supabase profiles table
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Upsert profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          telegram_id: userData.telegram_id,
          name: userData.name,
          active: userData.active,
        },
        { onConflict: "telegram_id" }
      )
      .select()
      .single();

    if (profileError) {
      console.error("Profile upsert error:", profileError);
      throw profileError;
    }

    // Upsert role
    const { error: roleError } = await supabase
      .from("user_roles")
      .upsert(
        {
          user_id: profile.id,
          role: userData.role,
        },
        { onConflict: "user_id,role" }
      );

    if (roleError) {
      console.error("Role upsert error:", roleError);
      // Try to delete existing role and insert new one
      await supabase.from("user_roles").delete().eq("user_id", profile.id);
      await supabase.from("user_roles").insert({
        user_id: profile.id,
        role: userData.role,
      });
    }

    // Create personal sheet U_<telegram_id> if it doesn't exist
    try {
      const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY")!;
      const sheetId = Deno.env.get("GOOGLE_SHEET_ID")!;
      const accessToken = await getAccessToken(serviceAccountKey);
      const sheetName = `U_${userData.telegram_id}`;

      // Check if sheet exists by trying to get it
      const checkResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}!A1`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!checkResponse.ok && checkResponse.status === 400) {
        // Sheet doesn't exist, create it
        const createResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              requests: [{ addSheet: { properties: { title: sheetName } } }],
            }),
          }
        );

        if (createResponse.ok) {
          // Add header row
          await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}!A1:I1?valueInputOption=USER_ENTERED`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                values: [["ID", "Название", "Описание", "Статус", "Приоритет", "Автор", "Исполнитель", "Создано", "Обновлено"]],
              }),
            }
          );
          console.log(`Created sheet ${sheetName} for user ${userData.name}`);
        }
      }
    } catch (sheetError) {
      console.error("Error creating personal sheet:", sheetError);
      // Don't fail login if sheet creation fails
    }

    return new Response(
      JSON.stringify({
        user: {
          id: profile.id,
          telegram_id: userData.telegram_id,
          name: userData.name,
          active: userData.active,
          role: userData.role,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Auth error:", error);
    const errorMessage = error instanceof Error ? error.message : "Authentication failed";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
