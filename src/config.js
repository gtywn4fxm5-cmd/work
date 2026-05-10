require('dotenv').config();

module.exports = {
  llm: {
    provider: 'github',
    token: process.env.MODELS_TOKEN || process.env.GITHUB_TOKEN,
    endpoint: 'https://models.inference.ai.azure.com/chat/completions',
    model: 'gpt-4o-mini'
  },
  notion: {
    apiKey: process.env.NOTION_API_KEY,
    databaseId: process.env.NOTION_DATABASE_ID
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID
  }
};
