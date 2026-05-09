export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const update = await request.json();
      const message = update.message;

      if (!message || !message.text) {
        return new Response('OK', { status: 200 });
      }

      const chatId = message.chat.id;
      const text = message.text;

      if (text.startsWith('/start') || text.startsWith('/help')) {
        await sendTelegramMessage(env.BOT_TOKEN, chatId, '⏳ 正在启动，请稍候...');
      }

      await triggerGitHubActions(env, { chatId, text });

      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};

async function sendTelegramMessage(botToken, chatId, text) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

async function triggerGitHubActions(env, payload) {
  const [owner, repo] = env.GITHUB_REPO.split('/');
  await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
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
}
