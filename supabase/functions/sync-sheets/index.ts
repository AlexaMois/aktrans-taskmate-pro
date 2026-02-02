import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHEET_HEADERS = [
  "id", "title", "description", "status", "priority", 
  "scope", "author", "owner", "created_at", "updated_at"
];

interface TaskData {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  scope: string;
  author_name: string;
  owner_name: string | null;
  owner_telegram_id: string | null;
  created_at: string;
  updated_at: string;
}

async function getAccessToken(serviceAccountKey: string): Promise<string> {
  const keyData = JSON.parse(serviceAccountKey);
  
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: keyData.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  
  const signatureInput = `${headerB64}.${payloadB64}`;
  
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = keyData.private_key.replace(pemHeader, "").replace(pemFooter, "").replace(/\s/g, "");
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(signatureInput)
  );
  
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  
  const jwt = `${signatureInput}.${signatureB64}`;
  
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  
  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function sheetExists(accessToken: string, sheetId: string, sheetName: string): Promise<boolean> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  
  if (!response.ok) return false;
  
  const data = await response.json();
  return data.sheets?.some((s: { properties: { title: string } }) => 
    s.properties.title === sheetName
  ) ?? false;
}

async function createSheet(accessToken: string, sheetId: string, sheetName: string): Promise<void> {
  // Create the sheet
  const createResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [{
          addSheet: {
            properties: { title: sheetName }
          }
        }]
      }),
    }
  );
  
  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Failed to create sheet: ${error}`);
  }
  
  // Add headers
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}!A1:J1?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [SHEET_HEADERS]
      }),
    }
  );
}

async function appendTaskToSheet(
  accessToken: string, 
  sheetId: string, 
  sheetName: string, 
  task: TaskData
): Promise<void> {
  const row = [
    task.id,
    task.title,
    task.description || "",
    task.status,
    task.priority.toString(),
    task.scope,
    task.author_name,
    task.owner_name || "",
    task.created_at,
    task.updated_at,
  ];
  
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}!A:J:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [row] }),
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to append row: ${error}`);
  }
}

export async function ensureUserSheetExists(telegramId: string): Promise<void> {
  const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
  const sheetId = Deno.env.get("GOOGLE_SHEET_ID");
  
  if (!serviceAccountKey || !sheetId) {
    console.log("Google credentials not configured, skipping sheet creation");
    return;
  }
  
  const accessToken = await getAccessToken(serviceAccountKey);
  const sheetName = `U_${telegramId}`;
  
  const exists = await sheetExists(accessToken, sheetId, sheetName);
  if (!exists) {
    console.log(`Creating sheet ${sheetName}`);
    await createSheet(accessToken, sheetId, sheetName);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, task, telegram_id } = await req.json();
    
    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    const sheetId = Deno.env.get("GOOGLE_SHEET_ID");
    
    if (!serviceAccountKey || !sheetId) {
      return new Response(
        JSON.stringify({ error: "Google credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const accessToken = await getAccessToken(serviceAccountKey);
    
    if (action === "create_user_sheet") {
      if (!telegram_id) {
        return new Response(
          JSON.stringify({ error: "telegram_id required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const sheetName = `U_${telegram_id}`;
      const exists = await sheetExists(accessToken, sheetId, sheetName);
      
      if (!exists) {
        await createSheet(accessToken, sheetId, sheetName);
        console.log(`Created sheet ${sheetName}`);
      }
      
      return new Response(
        JSON.stringify({ success: true, sheet: sheetName, created: !exists }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (action === "sync_task") {
      if (!task) {
        return new Response(
          JSON.stringify({ error: "task data required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const taskData = task as TaskData;
      
      // Determine target sheet
      let targetSheet: string;
      if (taskData.scope === "common") {
        targetSheet = "COMMON";
      } else if (taskData.scope === "personal" && taskData.owner_telegram_id) {
        targetSheet = `U_${taskData.owner_telegram_id}`;
        
        // Ensure user sheet exists
        const exists = await sheetExists(accessToken, sheetId, targetSheet);
        if (!exists) {
          await createSheet(accessToken, sheetId, targetSheet);
        }
      } else {
        return new Response(
          JSON.stringify({ error: "Invalid scope or missing owner_telegram_id for personal task" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      await appendTaskToSheet(accessToken, sheetId, targetSheet, taskData);
      
      return new Response(
        JSON.stringify({ success: true, sheet: targetSheet }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error: unknown) {
    console.error("Sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Sync failed";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
