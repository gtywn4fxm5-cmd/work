const axios = require('axios');
const config = require('./config');

const COMMANDS = [
  { command: 'start', description: '启动并显示帮助' },
  { command: 'triage', description: '业务分诊卡（分类→路由→风险→动作）' },
  { command: 'policy', description: '今日政策简报（含业务路由分析）' },
  { command: 'checklist', description: '材料清单+风险检查表' },
  { command: 'meeting', description: '会议速读卡' },
  { command: 'draft', description: '商务文档生成（邮件/方案）' },
  { command: 'log', description: '项目进度记录' },
  { command: 'ask', description: '业务问答（带风险审查）' },
  { command: 'status', description: '系统状态' }
];

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

async function setCommands() {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${config.telegram.botToken}/setMyCommands`,
      {
        commands: COMMANDS
      }
    );
    return response.data;
  } catch (error) {
    console.error('Telegram setCommands error:', error.message);
    return null;
  }
}

async function getCommands() {
  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${config.telegram.botToken}/getMyCommands`
    );
    return response.data;
  } catch (error) {
    console.error('Telegram getCommands error:', error.message);
    return null;
  }
}

module.exports = { sendMessage, getUpdates, confirmUpdates, setWebhook, deleteWebhook, setCommands, getCommands, COMMANDS };
