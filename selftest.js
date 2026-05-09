require('dotenv').config();
const axios = require('axios');

const results = [];

function log(step, ok, detail) {
  const status = ok ? '✅' : '❌';
  console.log(`${status} ${step}: ${detail}`);
  results.push({ step, ok, detail });
}

async function testTelegramSend() {
  console.log('\n=== 诊断: Telegram 发送 403 ===');

  const chatIdFromEnv = process.env.TELEGRAM_CHAT_ID;
  console.log(`TELEGRAM_CHAT_ID (环境变量): "${chatIdFromEnv}" (类型: ${typeof chatIdFromEnv}, 长度: ${chatIdFromEnv?.length})`);

  let chatIdFromMessages = null;
  try {
    const r = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUpdates`, {
      params: { offset: 0, timeout: 5 }
    });
    const updates = r.data.result || [];
    if (updates.length > 0) {
      chatIdFromMessages = String(updates[0].message.chat.id);
      console.log(`chat_id (来自消息): "${chatIdFromMessages}"`);
      console.log(`两者是否一致: ${chatIdFromEnv === chatIdFromMessages ? '✅ 一致' : '❌ 不一致！'}`);
    }
  } catch (e) {
    console.log('获取消息失败:', e.message);
  }

  const targets = [
    { label: '环境变量CHAT_ID', id: chatIdFromEnv },
    { label: '消息中的CHAT_ID', id: chatIdFromMessages }
  ].filter(t => t.id);

  for (const target of targets) {
    try {
      console.log(`\n尝试发送到 ${target.label} = "${target.id}"...`);
      const r = await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: target.id,
        text: `🔧 自检测试: 发送到 ${target.label} = ${target.id}`
      });
      log(`发送到${target.label}`, r.data.ok, `成功! chat_id="${target.id}"`);
    } catch (e) {
      const detail = e.response?.data || e.message;
      log(`发送到${target.label}`, false, `403错误! chat_id="${target.id}", 响应: ${JSON.stringify(detail)}`);
    }
  }

  console.log('\n可能原因:');
  console.log('  1. 你还没有在Telegram中点击Bot的"Start"按钮');
  console.log('  2. 你已经Block(拉黑)了这个Bot');
  console.log('  3. TELEGRAM_CHAT_ID设置错误');
  console.log('  4. Bot没有发送消息的权限');
}

async function testGemini() {
  console.log('\n=== 诊断: Gemini API ===');

  const apiKey = process.env.GEMINI_API_KEY;
  console.log(`API Key: "${apiKey?.substring(0, 15)}..." (长度: ${apiKey?.length})`);

  const models = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-pro',
    'gemini-2.0-flash'
  ];

  for (const model of models) {
    try {
      console.log(`\n尝试模型: ${model}...`);
      const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
      const r = await axios.post(url, {
        contents: [{ parts: [{ text: '回复OK' }] }]
      }, { timeout: 30000 });

      const text = r.data.candidates?.[0]?.content?.parts?.[0]?.text || '(无文本)';
      log(`Gemini ${model}`, true, `可用! 回复: ${text.substring(0, 30)}`);
      return;
    } catch (e) {
      const status = e.response?.status;
      const data = e.response?.data;
      console.log(`  ❌ ${model}: HTTP ${status}`);
      if (data) {
        console.log(`  错误详情: ${JSON.stringify(data).substring(0, 200)}`);
      } else {
        console.log(`  错误: ${e.message}`);
      }
    }
  }

  log('Gemini API', false, '所有模型均不可用');

  console.log('\n可能原因:');
  console.log('  1. API Key无效或已过期');
  console.log('  2. API Key没有启用Generative Language API');
  console.log('  3. API Key被限制IP（GitHub Actions的IP）');
  console.log('  4. 账户余额不足');
  console.log('\n建议: 访问 https://aistudio.google.com/apikey 重新生成API Key');
}

async function testOtherServices() {
  console.log('\n=== 快速检查其他服务 ===');

  try {
    const { Client } = require('@notionhq/client');
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const db = await notion.databases.retrieve({ database_id: process.env.NOTION_DATABASE_ID });
    log('Notion', true, `数据库: "${db.title[0]?.plain_text}"`);
  } catch (e) {
    log('Notion', false, e.message);
  }

  try {
    const r = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`);
    log('Telegram Bot', true, `@${r.data.result.username}`);
  } catch (e) {
    log('Telegram Bot', false, e.message);
  }

  try {
    const r = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMyCommands`);
    const cmds = r.data.result || [];
    log('命令菜单', cmds.length > 0, `已注册${cmds.length}个命令: ${cmds.map(c => '/' + c.command).join(', ')}`);
  } catch (e) {
    log('命令菜单', false, e.message);
  }
}

async function run() {
  console.log('🔍 系统诊断开始...\n');
  console.log('环境变量:');
  console.log(`  GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ 已设置' : '❌ 未设置'}`);
  console.log(`  NOTION_API_KEY: ${process.env.NOTION_API_KEY ? '✅ 已设置' : '❌ 未设置'}`);
  console.log(`  NOTION_DATABASE_ID: ${process.env.NOTION_DATABASE_ID ? '✅ 已设置' : '❌ 未设置'}`);
  console.log(`  TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ 已设置' : '❌ 未设置'}`);
  console.log(`  TELEGRAM_CHAT_ID: ${process.env.TELEGRAM_CHAT_ID ? '✅ 已设置' : '❌ 未设置'}`);

  await testOtherServices();
  await testTelegramSend();
  await testGemini();

  console.log('\n\n========== 诊断结果 ==========');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`通过: ${passed}, 失败: ${failed}`);
  results.forEach(r => {
    console.log(`  ${r.ok ? '✅' : '❌'} ${r.step}: ${r.detail}`);
  });
}

run().catch(e => console.error('诊断异常:', e));
