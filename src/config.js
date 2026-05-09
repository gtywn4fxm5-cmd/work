require('dotenv').config();

module.exports = {
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.5-flash-preview-05-20'
  },
  notion: {
    apiKey: process.env.NOTION_API_KEY,
    databaseId: process.env.NOTION_DATABASE_ID
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN
  },
  github: {
    token: process.env.GITHUB_TOKEN,
    repo: process.env.GITHUB_REPO
  }
};
