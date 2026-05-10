require('dotenv').config();

module.exports = {
  llm: {
    provider: 'github',
    token: process.env.GITHUB_TOKEN || process.env.MODELS_TOKEN,
    endpoint: 'https://models.inference.ai.azure.com/chat/completions',
    model: 'gpt-4o-mini'
  },
  notion: {
    apiKey: process.env.NOTION_API_KEY,
    databaseId: process.env.NOTION_DATABASE_ID,
    profileDbId: process.env.NOTION_PROFILE_DB_ID || null,
    pipelineDbId: process.env.NOTION_PIPELINE_DB_ID || null,
    caseDbId: process.env.NOTION_CASE_DB_ID || null
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID
  }
};
