const axios = require('axios');
const config = require('./config');

async function chat(messages, options = {}) {
  const response = await axios.post(
    config.llm.endpoint,
    {
      model: options.model || config.llm.model,
      messages: messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 4096
    },
    {
      headers: {
        'Authorization': `Bearer ${config.llm.token}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    }
  );

  return response.data.choices[0].message.content;
}

async function chatJSON(messages, options = {}) {
  const text = await chat(messages, { ...options, temperature: 0.3 });
  try {
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

module.exports = { chat, chatJSON };
