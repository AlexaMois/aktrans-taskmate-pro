import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { sanitizeForSheets, isValidUUID, isValidTelegramId, validateTextInput } from "../_shared/validation.ts";

import { getGoogleAccessToken } from "../_shared/googleAuth.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

interface SyncRequest {
  task: TaskData;
  action: "create" | "update";
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

// Validate status value
const VALID_STATUSES = ["ideas", "planned", "in_progress", "review", "done"];

// Validate priority value
const VALID_PRIORITIES = [1, 2, 3];

// Validate scope value
const VALID_SCOPES = ["common", "personal"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Support both old format (just task) and new format (task + action)
    let task: TaskData;
    let action: "create" | "update";
    
    if (body.task) {
      task = body.task;
      action = body.action || "create";
    } else {
      // Backward compatibility: old format without wrapper
      task = body;
      action = "create";
    }

    // Validate task ID
    if (!task.id || !isValidUUID(task.id)) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing task ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate and sanitize title
    const titleValidation = validateTextInput(task.title, 500);
    if (!titleValidation.valid) {
      return new Response(
        JSON.stringify({ error: `Invalid title: ${titleValidation.error}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate description length if provided
    if (task.description && task.description.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Description exceeds maximum length of 5000 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate status
    if (!VALID_STATUSES.includes(task.status)) {
      return new Response(
        JSON.stringify({ error: `Invalid status: ${task.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate priority
    if (!VALID_PRIORITIES.includes(task.priority)) {
      return new Response(
        JSON.stringify({ error: `Invalid priority: ${task.priority}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate scope
    if (!VALID_SCOPES.includes(task.scope)) {
      return new Response(
        JSON.stringify({ error: `Invalid scope: ${task.scope}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate telegram_id format if provided
    if (task.owner_telegram_id && !isValidTelegramId(task.owner_telegram_id)) {
      return new Response(
        JSON.stringify({ error: "Invalid owner_telegram_id format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    const sheetId = Deno.env.get("GOOGLE_SHEET_ID");

    if (!serviceAccountKey || !sheetId) {
      throw new Error("Google Sheets credentials not configured");
    }

    const accessToken = await getGoogleAccessToken(serviceAccountKey);

    // Determine sheet name based on scope
    let sheetName: string;
    if (task.scope === "common") {
      sheetName = "COMMON";
    } else if (task.scope === "personal" && task.owner_telegram_id) {
      sheetName = `U_${task.owner_telegram_id}`;
    } else {
      throw new Error("Invalid scope or missing owner_telegram_id for personal task");
    }

    // Format row data with sanitization to prevent formula injection
    const rowData = [
      task.id,
      sanitizeForSheets(task.title),
      sanitizeForSheets(task.description),
      STATUS_LABELS[task.status] || task.status,
      PRIORITY_LABELS[task.priority] || String(task.priority),
      sanitizeForSheets(task.author_name),
      sanitizeForSheets(task.owner_name),
      new Date(task.created_at).toLocaleString("ru-RU"),
      new Date(task.updated_at).toLocaleString("ru-RU"),
    ];

    if (action === "update") {
      // Find existing row by task ID and update it
      const findUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}!A:A`;
      const findResponse = await fetch(findUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (findResponse.ok) {
        const findData = await findResponse.json();
        const values = findData.values || [];
        let rowIndex = -1;

        for (let i = 0; i < values.length; i++) {
          if (values[i][0] === task.id) {
            rowIndex = i + 1; // Sheets are 1-indexed
            break;
          }
        }

        if (rowIndex > 0) {
          // Update existing row
          const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}!A${rowIndex}:I${rowIndex}?valueInputOption=USER_ENTERED`;
          const updateResponse = await fetch(updateUrl, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ values: [rowData] }),
          });

          if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            throw new Error(`Failed to update row: ${errorText}`);
          }

          return new Response(
            JSON.stringify({ success: true, sheet: sheetName, action: "updated", row: rowIndex }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      // If row not found, fall through to append (create)
    }

    // Append row to the sheet (for create or if update didn't find existing row)
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
      JSON.stringify({ success: true, sheet: sheetName, action: "created" }),
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
