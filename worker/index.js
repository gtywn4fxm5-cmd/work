export default {
  async fetch(request, env) {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({ status: 'ok', time: new Date().toISOString() }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('Method not allowed', { status: 405 });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const update = await request.json();
      const message = update.message || update.edited_message;

      if (!message || !message.text) {
        return new Response('OK', { status: 200 });
      }

      const chatId = message.chat.id;
      const text = message.text.trim();

      if (!text.startsWith('/')) {
        return new Response('OK', { status: 200 });
      }

      const allowedChatId = parseInt(env.ALLOWED_CHAT_ID || '0');
      if (allowedChatId && chatId !== allowedChatId) {
        return new Response('OK', { status: 200 });
      }

      await sendTelegramMessage(env.BOT_TOKEN, chatId, '⏳ 正在处理...');

      await triggerGitHubActions(env, { chatId: String(chatId), text });

      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('Worker error:', error.message);
      return new Response('OK', { status: 200 });
    }
  }
};

async function sendTelegramMessage(botToken, chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
  } catch (e) {
    console.error('Telegram send error:', e.message);
  }
}

async function triggerGitHubActions(env, payload) {
  const [owner, repo] = env.GITHUB_REPO.split('/');
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Cloudflare-Worker'
    },
    body: JSON.stringify({
      event_type: 'telegram_message',
      client_payload: payload
    })
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`GitHub dispatch failed: ${response.status} ${body}`);
  }
}
