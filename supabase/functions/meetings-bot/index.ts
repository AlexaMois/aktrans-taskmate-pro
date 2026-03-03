import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getGoogleAccessToken } from "../_shared/googleAuth.ts";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SHEET_ID = Deno.env.get("GOOGLE_SHEET_ID")!;
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SHEET_NAME = "Meetings";

// ─── Telegram helpers ───────────────────────────────────────────────────────

async function sendMessage(chatId: number, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function getFileUrl(fileId: string): Promise<string> {
  const res = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`
  );
  const data = await res.json();
  if (!data.ok) throw new Error(`getFile failed: ${JSON.stringify(data)}`);
  return `https://api.telegram.org/file/bot${BOT_TOKEN}/${data.result.file_path}`;
}

// ─── File text extraction ────────────────────────────────────────────────────

async function extractText(fileId: string, fileName: string): Promise<string> {
  const url = await getFileUrl(fileId);
  const res = await fetch(url);
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "txt") {
    return await res.text();
  }

  // For docx/pdf — read as text (works for basic docx/txt content)
  // Full docx/pdf parsing requires external service; txt is recommended
  const buffer = await res.arrayBuffer();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const raw = decoder.decode(buffer);

  // Strip binary garbage — keep only printable chars
  return raw.replace(/[^\x20-\x7E\u0400-\u04FF\n\r\t]/g, " ").replace(/\s{3,}/g, "\n").trim();
}

// ─── Google Sheets helpers ───────────────────────────────────────────────────

async function appendMeeting(
  accessToken: string,
  date: string,
  telegramId: string,
  fileName: string,
  text: string
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}!A:D:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [[date, telegramId, fileName, text]] }),
  });
  if (!res.ok) {
    const err = await res.text();
    // Sheet might not exist yet — create it then retry
    if (res.status === 400) {
      await createMeetingsSheet(accessToken);
      await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [[date, telegramId, fileName, text]] }),
      });
    } else {
      throw new Error(`Sheets append error: ${err}`);
    }
  }
}

async function createMeetingsSheet(accessToken: string): Promise<void> {
  // Create sheet
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: SHEET_NAME } } }],
    }),
  });
  // Add header row
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}!A1:D1?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [["Date", "Telegram_ID", "Filename", "Text"]] }),
    }
  );
}

async function getTodayMeetings(
  accessToken: string,
  telegramId: string
): Promise<string[]> {
  const today = new Date().toISOString().split("T")[0];
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}!A:D`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  if (!data.values || data.values.length < 2) return [];

  return data.values
    .slice(1)
    .filter((row: string[]) => row[0] === today && row[1] === telegramId)
    .map((row: string[], i: number) => `=== Совещание ${i + 1} (${row[2]}) ===\n${row[3]}`);
}

// ─── LLM summary ─────────────────────────────────────────────────────────────

async function getSummary(texts: string[]): Promise<string> {
  const combined = texts.join("\n\n");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Ты — личный ассистент руководителя. Отвечай на русском языке.",
        },
        {
          role: "user",
          content: `Проанализируй стенограммы совещаний за день. Выдай структурированно:\n1. Краткое резюме по каждому совещанию (2-3 строки)\n2. Список задач и договорённостей\n3. Ключевые решения\n4. Открытые вопросы\n\nСтенограммы:\n${combined}`,
        },
      ],
      max_tokens: 2000,
    }),
  });
  const data = await res.json();
  if (!data.choices?.[0]?.message?.content) {
    throw new Error(`LLM error: ${JSON.stringify(data)}`);
  }
  return data.choices[0].message.content;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  try {
    const update = await req.json();
    const message = update?.message;
    if (!message) return new Response("ok");

    const chatId: number = message.chat.id;
    const telegramId: string = message.from.id.toString();
    const text: string = message.text ?? "";
    const today = new Date().toISOString().split("T")[0];

    // ── Command: /сводка ──────────────────────────────────────────────────────
    if (text === "/сводка" || text === "/summary") {
      const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY")!;
      const accessToken = await getGoogleAccessToken(serviceAccountKey);
      const meetings = await getTodayMeetings(accessToken, telegramId);

      if (meetings.length === 0) {
        await sendMessage(chatId, `За сегодня (${today}) стенограмм не найдено.\nОтправь файл (.txt, .docx, .pdf) чтобы начать.`);
        return new Response("ok");
      }

      await sendMessage(chatId, `⏳ Формирую сводку по ${meetings.length} совещани${meetings.length === 1 ? "ю" : "ям"}...`);

      const summary = await getSummary(meetings);
      await sendMessage(chatId, `📋 Сводка за ${today}:\n\n${summary}`);
      return new Response("ok");
    }

    // ── Command: /помощь ─────────────────────────────────────────────────────
    if (text === "/помощь" || text === "/help" || text === "/start") {
      await sendMessage(
        chatId,
        `📎 Привет! Я веду дневник совещаний.\n\nКак пользоваться:\n• Отправь файл (.txt, .docx, .pdf) — сохраню стенограмму\n• Напиши /сводка — получи итоги дня от AI\n• Напиши /помощь — это сообщение\n\nВсе стенограммы сохраняются в Google Sheets.`
      );
      return new Response("ok");
    }

    // ── Incoming file ─────────────────────────────────────────────────────────
    if (message.document) {
      const { file_id, file_name, mime_type } = message.document;
      const name: string = file_name ?? "transcript.txt";
      const mime: string = mime_type ?? "text/plain";

      // Validate file type
      const allowed = ["text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/pdf", "application/msword"];
      const ext = name.split(".").pop()?.toLowerCase() ?? "";
      const allowedExt = ["txt", "docx", "doc", "pdf"];

      if (!allowed.includes(mime) && !allowedExt.includes(ext)) {
        await sendMessage(chatId, `❌ Формат не поддерживается: ${name}\nПоддерживаются: .txt, .docx, .pdf`);
        return new Response("ok");
      }

      await sendMessage(chatId, `⏳ Обрабатываю файл ${name}...`);

      const extractedText = await extractText(file_id, name);

      if (!extractedText || extractedText.length < 10) {
        await sendMessage(chatId, `❌ Не удалось извлечь текст из ${name}.\nПопробуй сохранить как .txt`);
        return new Response("ok");
      }

      const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY")!;
      const accessToken = await getGoogleAccessToken(serviceAccountKey);
      await appendMeeting(accessToken, today, telegramId, name, extractedText);

      const allToday = await getTodayMeetings(accessToken, telegramId);
      await sendMessage(
        chatId,
        `✅ Стенограмма сохранена: ${name}\n📅 Всего за сегодня: ${allToday.length} совещани${allToday.length === 1 ? "е" : "й"}\n\nНапиши /сводка когда будешь готова.`
      );
      return new Response("ok");
    }

    // ── Unknown message ───────────────────────────────────────────────────────
    if (text && !text.startsWith("/")) {
      await sendMessage(chatId, `Отправь файл (.txt, .docx, .pdf) или напиши /помощь`);
    }

    return new Response("ok");
  } catch (error: unknown) {
    console.error("meetings-bot error:", error);
    return new Response("ok"); // Always return 200 to Telegram
  }
});