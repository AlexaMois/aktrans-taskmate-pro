import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getGoogleAccessToken } from "../_shared/googleAuth.ts";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SHEET_ID = Deno.env.get("GOOGLE_SHEET_ID")!;
const PERPLEXITY_KEY = Deno.env.get("PERPLEXITY_API_KEY")!;
const SHEET_NAME = "Meetings";

// ─── Telegram helpers ────────────────────────────────────────────────────────
console.log("BOT_TOKEN length:", BOT_TOKEN?.length, "SHEET_ID:", SHEET_ID?.length);

// Auto-set webhook on boot
fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({url: 'https://hvsighjpcycwoqpmuvga.supabase.co/functions/v1/meetings-bot'})
}).then(r => r.text()).then(t => console.log('webhook:', t));

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

// ─── File text extraction ──────────────────────────────────────────────────
async function extractText(fileId: string, fileName: string): Promise<string> {
  const url = await getFileUrl(fileId);
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const text = new TextDecoder("utf-8").decode(buf);
  return text.slice(0, 15000); // limit
}

// ─── Google Sheets ────────────────────────────────────────────────────────
async function appendRow(values: string[]): Promise<void> {
  const token = await getGoogleAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}!A1:append?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [values] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Sheets error: ${JSON.stringify(data)}`);
  console.log("Sheets append ok:", JSON.stringify(data).slice(0, 200));
}

async function getRows(): Promise<string[][]> {
  const token = await getGoogleAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}!A2:D`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Sheets read error: ${JSON.stringify(data)}`);
  return data.values ?? [];
}

// ─── Perplexity summary ───────────────────────────────────────────────────
async function getSummary(texts: string[]): Promise<string> {
  const combined = texts.join("\n\n---\n\n");
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PERPLEXITY_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        {
          role: "system",
          content: "Ты аналитик совещаний. Составь краткую сводку за день: ключевые темы, решения, задачи. Отвечай на русском языке.",
        },
        {
          role: "user",
          content: `Вот стенограммы совещаний за сегодня:\n\n${combined}`,
        },
      ],
      max_tokens: 1500,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Perplexity error: ${JSON.stringify(data)}`);
  return data.choices[0].message.content;
}

// ─── Main handler ─────────────────────────────────────────────────────────
serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("ok");
    const body = await req.json();
    const msg = body.message;
    if (!msg) return new Response("ok");

    const chatId: number = msg.chat.id;
    const text: string = msg.text ?? "";
    const userId: number = msg.from?.id ?? 0;

    // /сводка command
    if (text.startsWith("/") && (text.includes("сводка") || text.includes("summary"))) {
      await sendMessage(chatId, "Собираю сводку за сегодня...");
      try {
        const rows = await getRows();
        const today = new Date().toISOString().slice(0, 10);
        const todayRows = rows.filter(r => r[0]?.startsWith(today));
        if (todayRows.length === 0) {
          await sendMessage(chatId, "Сегодня стенограмм не загружалось.");
          return new Response("ok");
        }
        const texts = todayRows.map(r => `Файл: ${r[2] ?? ""} \n${r[3] ?? ""}`);
        const summary = await getSummary(texts);
        await sendMessage(chatId, `📋 Сводка за ${today}:\n\n${summary}`);
      } catch (e) {
        console.error("summary error:", e);
        await sendMessage(chatId, `Ошибка при создании сводки: ${e.message}`);
      }
      return new Response("ok");
    }

    // /start command
    if (text === "/start") {
      await sendMessage(chatId, "Привет! Отправь мне .txt файл со стенограммой совещания. В конце дня используй /сводка для получения итогов.");
      return new Response("ok");
    }

    // Handle document
    if (msg.document) {
      const doc = msg.document;
      const fileName: string = doc.file_name ?? "file";
      const fileId: string = doc.file_id;

      await sendMessage(chatId, `Получил файл: ${fileName}. Обрабатываю...`);

      try {
        const extracted = await extractText(fileId, fileName);
        const date = new Date().toISOString();
        await appendRow([date, String(userId), fileName, extracted]);
        await sendMessage(chatId, `✅ Файл сохранён в таблицу! (${extracted.length} символов)`);
      } catch (e) {
        console.error("file error:", e);
        await sendMessage(chatId, `❌ Ошибка: ${e.message}`);
      }
      return new Response("ok");
    }

    // Default
    if (text && !text.startsWith("/")) {
      await sendMessage(chatId, "Отправь .txt файл со стенограммой или используй /сводка");
    }

    return new Response("ok");
  } catch (error) {
    console.error("meetings-bot error:", error);
    return new Response("ok"); // Always return 200 to Telegram
  }
});
