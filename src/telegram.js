const axios = require('axios');
const config = require('./config');

async function sendMessage(chatId, text) {
  const maxLen = 4096;
  const chunks = [];
  for (let i = 0; i < text.length; i += maxLen) {
    chunks.push(text.slice(i, i + maxLen));
  }

  for (const chunk of chunks) {
    try {
      await axios.post(
        `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`,
        {
          chat_id: chatId,
          text: chunk,
          parse_mode: 'Markdown'
        }
      );
    } catch (error) {
      console.error('Telegram send error:', error.response?.data || error.message);
    }
  }
}

async function getUpdates(offset) {
  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${config.telegram.botToken}/getUpdates`,
      { params: { offset: offset || 0, timeout: 30 } }
    );
    return response.data.result || [];
  } catch (error) {
    console.error('Telegram getUpdates error:', error.message);
    return [];
  }
}

async function confirmUpdates(lastUpdateId) {
  if (!lastUpdateId) return;
  try {
    await axios.get(
      `https://api.telegram.org/bot${config.telegram.botToken}/getUpdates`,
      { params: { offset: lastUpdateId + 1, timeout: 0 } }
    );
  } catch (error) {
    console.error('Telegram confirm error:', error.message);
  }
}

async function setWebhook(url) {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${config.telegram.botToken}/setWebhook`,
      { url }
    );
    return response.data;
  } catch (error) {
    console.error('Telegram setWebhook error:', error.message);
    return null;
  }
}

async function deleteWebhook() {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${config.telegram.botToken}/deleteWebhook`
    );
    return response.data;
  } catch (error) {
    console.error('Telegram deleteWebhook error:', error.message);
    return null;
  }
}

module.exports = { sendMessage, getUpdates, confirmUpdates, setWebhook, deleteWebhook };
