const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Environment variables
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID;

async function fetchTodayTranscripts() {
  try {
    // Get today's date in Moscow timezone
    const today = new Date();
    const moscowOffset = 3 * 60; // UTC+3
    const moscowTime = new Date(today.getTime() + moscowOffset * 60 * 1000);
    const todayStr = moscowTime.toISOString().split('T')[0];
    
    console.log(`Fetching transcripts for date: ${todayStr}`);
    
    // Query Supabase for today's transcripts
    const { data, error } = await supabase
      .from('transcripts')
      .select('*')
      .gte('created_at', `${todayStr}T00:00:00`)
      .lte('created_at', `${todayStr}T23:59:59`)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching from Supabase:', error);
      return [];
    }
    
    console.log(`Found ${data?.length || 0} transcripts`);
    return data || [];
  } catch (error) {
    console.error('Error in fetchTodayTranscripts:', error);
    return [];
  }
}

async function generateSummary(transcripts) {
  if (!transcripts || transcripts.length === 0) {
    return 'Сегодня не было загружено стенограмм совещаний.';
  }
  
  // Combine all transcripts
  const combinedText = transcripts
    .map((t, idx) => `\n--- Стенограмма ${idx + 1} (${t.filename || 'без имени'}) ---\n${t.text}`)
    .join('\n\n');
  
  const prompt = `Проанализируй следующие стенограммы совещаний за сегодняшний день и создай структурированную сводку на русском языке. Включи:\n\n1. Основные темы обсуждений\n2. Ключевые решения\n3. Назначенные задачи и ответственные\n4. Важные детали и договоренности\n\nСтенограммы:\n${combinedText}`;
  
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-large-128k-online',
        messages: [
          {
            role: 'system',
            content: 'Ты - опытный аналитик, специализирующийся на анализе деловых совещаний и создании структурированных сводок.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 2000
      })
    });
    
    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error generating summary:', error);
    return `Ошибка при создании сводки: ${error.message}`;
  }
}

async function sendTelegramMessage(text) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: 'Markdown'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.statusText}`);
    }
    
    console.log('Summary sent to Telegram successfully');
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('Starting daily summary generation...');
    
    // Fetch today's transcripts
    const transcripts = await fetchTodayTranscripts();
    
    // Generate summary
    console.log('Generating summary with Perplexity AI...');
    const summary = await generateSummary(transcripts);
    
    // Format the message
    const today = new Date();
    const dateStr = today.toLocaleDateString('ru-RU', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    const message = `📋 *Дневная сводка совещаний*\n_${dateStr}_\n\n${summary}`;
    
    // Send to Telegram
    console.log('Sending summary to Telegram...');
    await sendTelegramMessage(message);
    
    console.log('Daily summary completed successfully!');
  } catch (error) {
    console.error('Fatal error in main:', error);
    process.exit(1);
  }
}

// Run the script
main();
