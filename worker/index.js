export default {
  async fetch(request, env) {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({ status: 'ok', time: new Date().toISOString(), repo: env.GITHUB_REPO, hasToken: !!env.GITHUB_TOKEN }), {
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

      const result = await triggerGitHubActions(env, { chatId: String(chatId), text });

      if (!result.ok) {
        await sendTelegramMessage(env.BOT_TOKEN, chatId, `❌ 触发失败: ${result.error}`);
        return new Response(JSON.stringify({ error: result.error }), { status: 500 });
      }

      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('Worker error:', error.message);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
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
  const [owner, repo] = (env.GITHUB_REPO || '').split('/');
  
  if (!owner || !repo) {
    return { ok: false, error: `GITHUB_REPO not set or invalid: ${env.GITHUB_REPO}` };
  }

  if (!env.GITHUB_TOKEN) {
    return { ok: false, error: 'GITHUB_TOKEN not set' };
  }

  try {
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
      return { ok: false, error: `GitHub API ${response.status}: ${body}` };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
