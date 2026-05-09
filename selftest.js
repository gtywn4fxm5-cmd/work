require('dotenv').config();
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Client } = require('@notionhq/client');

const results = [];

function log(step, ok, detail) {
  const status = ok ? '✅' : '❌';
  const msg = `${status} ${step}: ${detail}`;
  console.log(msg);
  results.push({ step, ok, detail });
}

async function testTelegramBot() {
  console.log('\n=== 测试1: Telegram Bot 连接 ===');
  try {
    const r = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`);
    log('Telegram Bot', true, `Bot名称: ${r.data.result.username}, 状态: ${r.data.result.first_name}`);
  } catch (e) {
    log('Telegram Bot', false, e.message);
  }
}

async function testTelegramCommands() {
  console.log('\n=== 测试2: 注册命令菜单 ===');
  const commands = [
    { command: 'start', description: '启动并显示帮助' },
    { command: 'triage', description: '业务分诊卡' },
    { command: 'policy', description: '今日政策简报' },
    { command: 'checklist', description: '材料清单' },
    { command: 'meeting', description: '会议速读卡' },
    { command: 'draft', description: '商务文档生成' },
    { command: 'log', description: '项目进度记录' },
    { command: 'ask', description: '业务问答' },
    { command: 'status', description: '系统状态' }
  ];
  try {
    const r = await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setMyCommands`, { commands });
    log('注册命令', r.data.ok, JSON.stringify(r.data));
  } catch (e) {
    log('注册命令', false, e.message);
  }
}

async function testTelegramWebhook() {
  console.log('\n=== 测试3: 检查Webhook状态 ===');
  try {
    const r = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
    const info = r.data.result;
    log('Webhook状态', true, `url: "${info.url}", 是否设置: ${info.url ? '是(需删除)' : '否(正常)'}`);
    if (info.url) {
      console.log('  → 正在删除webhook...');
      const dr = await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/deleteWebhook`);
      log('删除Webhook', dr.data.ok, JSON.stringify(dr.data));
    }
  } catch (e) {
    log('Webhook检查', false, e.message);
  }
}

async function testTelegramGetUpdates() {
  console.log('\n=== 测试4: 获取消息 ===');
  try {
    const r = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUpdates`, {
      params: { offset: 0, timeout: 5 }
    });
    const updates = r.data.result || [];
    log('获取消息', true, `待处理消息数: ${updates.length}`);
    if (updates.length > 0) {
      updates.forEach(u => {
        const msg = u.message?.text || '(非文本消息)';
        console.log(`  → update_id=${u.update_id}, chat_id=${u.message?.chat?.id}, text="${msg}"`);
      });
    }
  } catch (e) {
    log('获取消息', false, e.message);
  }
}

async function testTelegramSend() {
  console.log('\n=== 测试5: 发送消息 ===');
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    log('发送消息', false, 'TELEGRAM_CHAT_ID 未设置');
    return;
  }
  try {
    const r = await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: '🔧 系统自检：Telegram发送测试成功！'
    });
    log('发送消息', r.data.ok, `消息已发送到 chat_id=${chatId}`);
  } catch (e) {
    log('发送消息', false, `${e.message} | chat_id=${chatId}`);
  }
}

async function testGemini() {
  console.log('\n=== 测试6: Gemini API ===');
  try {
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const models = ['gemini-2.5-flash-preview-05-20', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let successModel = null;

    for (const modelName of models) {
      try {
        console.log(`  尝试模型: ${modelName}...`);
        const model = ai.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('回复"OK"即可');
        const text = result.response.text();
        console.log(`  ✅ ${modelName} 可用! 回复: ${text.substring(0, 30)}`);
        successModel = modelName;
        break;
      } catch (e) {
        console.log(`  ❌ ${modelName} 不可用: ${e.message.substring(0, 80)}`);
      }
    }

    if (successModel) {
      log('Gemini API', true, `可用模型: ${successModel}`);
    } else {
      log('Gemini API', false, '所有模型均不可用');
    }
  } catch (e) {
    log('Gemini API', false, e.message);
  }
}

async function testNotion() {
  console.log('\n=== 测试7: Notion API ===');
  try {
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const db = await notion.databases.retrieve({ database_id: process.env.NOTION_DATABASE_ID });
    log('Notion连接', true, `数据库: "${db.title[0]?.plain_text}", 属性数: ${Object.keys(db.properties).length}`);
  } catch (e) {
    log('Notion连接', false, e.message);
  }
}

async function testNotionWrite() {
  console.log('\n=== 测试8: Notion写入 ===');
  try {
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const page = await notion.pages.create({
      parent: { database_id: process.env.NOTION_DATABASE_ID },
      properties: {
        name: { title: [{ text: { content: `自检测试 - ${new Date().toISOString()}` } }] },
        Type: { multi_select: [{ name: '系统测试' }] }
      },
      children: [{
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content: '这是一条自检测试记录，可以删除。' } }] }
      }]
    });
    log('Notion写入', true, `页面已创建: ${page.url}`);
  } catch (e) {
    log('Notion写入', false, e.message);
  }
}

async function runAllTests() {
  console.log('🔍 开始系统自检...');
  console.log('环境变量检查:');
  console.log(`  GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '已设置(' + process.env.GEMINI_API_KEY.substring(0, 10) + '...)' : '❌ 未设置'}`);
  console.log(`  NOTION_API_KEY: ${process.env.NOTION_API_KEY ? '已设置(' + process.env.NOTION_API_KEY.substring(0, 10) + '...)' : '❌ 未设置'}`);
  console.log(`  NOTION_DATABASE_ID: ${process.env.NOTION_DATABASE_ID ? '已设置' : '❌ 未设置'}`);
  console.log(`  TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? '已设置(' + process.env.TELEGRAM_BOT_TOKEN.substring(0, 10) + '...)' : '❌ 未设置'}`);
  console.log(`  TELEGRAM_CHAT_ID: ${process.env.TELEGRAM_CHAT_ID ? '已设置(' + process.env.TELEGRAM_CHAT_ID + ')' : '❌ 未设置'}`);

  await testTelegramBot();
  await testTelegramCommands();
  await testTelegramWebhook();
  await testTelegramGetUpdates();
  await testTelegramSend();
  await testGemini();
  await testNotion();
  await testNotionWrite();

  console.log('\n\n========== 自检结果汇总 ==========');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`通过: ${passed}/${results.length}, 失败: ${failed}/${results.length}`);
  results.forEach(r => {
    console.log(`  ${r.ok ? '✅' : '❌'} ${r.step}: ${r.detail}`);
  });

  if (failed > 0) {
    console.log('\n⚠️ 存在失败项，请检查上方详细日志。');
    process.exit(1);
  } else {
    console.log('\n🎉 所有测试通过！');
  }
}

runAllTests().catch(e => {
  console.error('自检异常:', e);
  process.exit(1);
});
