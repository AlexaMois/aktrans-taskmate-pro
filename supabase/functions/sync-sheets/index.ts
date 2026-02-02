import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getAccessToken(serviceAccountKey: string): Promise<string> {
  const keyData = JSON.parse(serviceAccountKey);
  
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  
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

const PRIORITY_LABELS: Record<number, string> = {
  1: "Высокий",
  2: "Средний",
  3: "Низкий",
};

const STATUS_LABELS: Record<string, string> = {
  ideas: "Идеи",
  planned: "Запланировано",
  in_progress: "В разработке",
  review: "На проверке",
  done: "Завершено",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const task: TaskData = await req.json();

    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    const sheetId = Deno.env.get("GOOGLE_SHEET_ID");

    if (!serviceAccountKey || !sheetId) {
      throw new Error("Google Sheets credentials not configured");
    }

    const accessToken = await getAccessToken(serviceAccountKey);

    // Determine sheet name based on scope
    let sheetName: string;
    if (task.scope === "common") {
      sheetName = "COMMON";
    } else if (task.scope === "personal" && task.owner_telegram_id) {
      sheetName = `U_${task.owner_telegram_id}`;
    } else {
      throw new Error("Invalid scope or missing owner_telegram_id for personal task");
    }

    // Format row data matching docs/GOOGLE_SHEETS_STRUCTURE.md
    const rowData = [
      task.id,
      task.title,
      task.description || "",
      STATUS_LABELS[task.status] || task.status,
      PRIORITY_LABELS[task.priority] || String(task.priority),
      task.author_name,
      task.owner_name || "",
      new Date(task.created_at).toLocaleString("ru-RU"),
      new Date(task.updated_at).toLocaleString("ru-RU"),
    ];

    // Append row to the sheet
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}!A:I:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const appendResponse = await fetch(appendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [rowData],
      }),
    });

    if (!appendResponse.ok) {
      const errorText = await appendResponse.text();
      console.error("Google Sheets append error:", errorText);
      
      // Check if sheet doesn't exist (for personal sheets)
      if (appendResponse.status === 400 && task.scope === "personal") {
        // Try to create the sheet first
        const createSheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`;
        
        const createResponse = await fetch(createSheetUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requests: [
              {
                addSheet: {
                  properties: {
                    title: sheetName,
                  },
                },
              },
            ],
          }),
        });

        if (createResponse.ok) {
          // Add header row
          const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}!A1:I1?valueInputOption=USER_ENTERED`;
          await fetch(headerUrl, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              values: [["ID", "Название", "Описание", "Статус", "Приоритет", "Автор", "Исполнитель", "Создано", "Обновлено"]],
            }),
          });

          // Retry append
          const retryResponse = await fetch(appendUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              values: [rowData],
            }),
          });

          if (!retryResponse.ok) {
            const retryError = await retryResponse.text();
            throw new Error(`Failed to append after creating sheet: ${retryError}`);
          }
        } else {
          const createError = await createResponse.text();
          throw new Error(`Failed to create sheet ${sheetName}: ${createError}`);
        }
      } else {
        throw new Error(`Failed to append to Google Sheets: ${errorText}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sheet: sheetName }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
