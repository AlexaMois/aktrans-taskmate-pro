import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

async function getAccessToken(serviceAccountKey: string): Promise<string> {
  const keyData = JSON.parse(serviceAccountKey);
  
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: keyData.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  
  const signatureInput = `${headerB64}.${payloadB64}`;
  
  // Import the private key
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  let pemContents = keyData.private_key.replace(pemHeader, "").replace(pemFooter, "").replace(/\s/g, "");
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(signatureInput)
  );
  
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  
  const jwt = `${signatureInput}.${signatureB64}`;
  
  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  
  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function getUserFromGoogleSheet(telegramId: string): Promise<UserData | null> {
  const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
  const sheetId = Deno.env.get("GOOGLE_SHEET_ID");
  
  if (!serviceAccountKey || !sheetId) {
    console.error("Missing Google credentials");
    throw new Error("Google credentials not configured");
  }

  const accessToken = await getAccessToken(serviceAccountKey);
  
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

    if (!telegram_id) {
      return new Response(
        JSON.stringify({ error: "Telegram ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user from Google Sheet
    const userData = await getUserFromGoogleSheet(telegram_id.toString().trim());

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

    // Create user's personal Google Sheet on first login
    try {
      const sheetId = Deno.env.get("GOOGLE_SHEET_ID");
      const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
      
      if (sheetId && serviceAccountKey) {
        const accessToken = await getAccessToken(serviceAccountKey);
        const sheetName = `U_${userData.telegram_id}`;
        
        // Check if sheet exists
        const checkResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        
        if (checkResponse.ok) {
          const sheetsData = await checkResponse.json();
          const exists = sheetsData.sheets?.some((s: { properties: { title: string } }) => 
            s.properties.title === sheetName
          );
          
          if (!exists) {
            // Create sheet
            await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  requests: [{
                    addSheet: { properties: { title: sheetName } }
                  }]
                }),
              }
            );
            
            // Add headers
            const headers = ["id", "title", "description", "status", "priority", 
                           "scope", "author", "owner", "created_at", "updated_at"];
            await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}!A1:J1?valueInputOption=RAW`,
              {
                method: "PUT",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ values: [headers] }),
              }
            );
            
            console.log(`Created personal sheet: ${sheetName}`);
          }
        }
      }
    } catch (sheetError) {
      console.error("Sheet creation error (non-fatal):", sheetError);
      // Don't fail auth if sheet creation fails
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
