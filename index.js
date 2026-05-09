require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { processMessage } = require('./src/main');
const { getUpdates, confirmUpdates, deleteWebhook, sendMessage } = require('./src/telegram');
const { fetchFromGoogleAlerts } = require('./src/policy-scraper');
const { summarizePolicy, generateMeetingPrep, generateChecklist } = require('./src/policy-analyzer');
const { saveRecord } = require('./src/knowledge');

const OFFSET_FILE = path.join(__dirname, '.offset');

function readOffset() {
  try {
    return parseInt(fs.readFileSync(OFFSET_FILE, 'utf8'), 10) || 0;
  } catch {
    return 0;
  }
}

function writeOffset(offset) {
  try {
    fs.writeFileSync(OFFSET_FILE, String(offset), 'utf8');
  } catch (error) {
    console.error('写入offset失败:', error.message);
  }
}

async function handleUpdate(update) {
  const message = update.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const text = message.text.trim();

  if (text === '/start') {
    await sendMessage(chatId, `🤖 跨境金融AI助手 v3.0

核心功能：
� /policy   - 今日政策简报（每日自动推送）
� /checklist - 生成材料清单（如: /checklist 香港 ODI）
🤝 /meeting  - 会议速读卡（如: /meeting 香港公司注册咨询）
❓ /ask      - 业务问答（如: /ask ODI备案流程）
📊 /status   - 系统状态

直接发消息 = /ask 模式`);
    return;
  }

  if (text === '/help') {
    await sendMessage(chatId, `� 使用指南

📰 /policy
  每日8:30自动推送，也可手动触发
  自动扫描跨境金融相关政策更新

📋 /checklist [地区] [业务]
  生成完整的材料清单和风险检查表
  例: /checklist 香港 公司注册
  例: /checklist 新加坡 ODI

🤝 /meeting [会议主题]
  生成会议速读卡
  例: /meeting 香港公司注册咨询
  例: /meeting 迪拜投资架构讨论

❓ /ask [问题]
  跨境金融业务问答
  例: /ask ODI备案需要什么材料

📊 /status
  查看系统运行状态`);
    return;
  }

  if (text === '/policy') {
    await handlePolicyCommand(chatId);
    return;
  }

  if (text.startsWith('/checklist')) {
    const args = text.replace('/checklist', '').trim();
    await handleChecklistCommand(chatId, args);
    return;
  }

  if (text.startsWith('/meeting')) {
    const args = text.replace('/meeting', '').trim();
    await handleMeetingCommand(chatId, args);
    return;
  }

  if (text.startsWith('/ask')) {
    const question = text.replace('/ask', '').trim();
    await processMessage(chatId, question || text);
    return;
  }

  if (text === '/status') {
    await sendMessage(chatId, `📊 系统状态\n\n✅ Telegram Bot: 运行中\n✅ GitHub Actions: 定时执行\n✅ Notion: 已连接\n⏰ 每日政策推送: 8:30 (UTC+8)`);
    return;
  }

  await processMessage(chatId, text);
}

async function handlePolicyCommand(chatId) {
  await sendMessage(chatId, '🔍 正在扫描政策更新，请稍候...');

  try {
    const policyItems = await fetchFromGoogleAlerts();

    if (policyItems.length === 0) {
      await sendMessage(chatId, '📰 今日暂无新的跨境金融政策更新。');
      return;
    }

    const summary = await summarizePolicy(policyItems);
    await sendMessage(chatId, summary);

    await saveRecord(
      `政策简报 - ${new Date().toLocaleDateString('zh-CN')}`,
      summary,
      '政策更新',
      '中国',
      'medium'
    );
  } catch (error) {
    console.error('政策推送失败:', error);
    await sendMessage(chatId, `❌ 政策扫描失败: ${error.message}`);
  }
}

async function handleChecklistCommand(chatId, args) {
  const parts = args.split(/\s+/);
  const region = parts[0] || '通用';
  const businessType = parts.slice(1).join(' ') || '通用';

  await sendMessage(chatId, `📋 正在生成材料清单...\n地区: ${region}\n业务: ${businessType}`);

  try {
    const checklist = await generateChecklist(businessType, region);
    await sendMessage(chatId, checklist);

    await saveRecord(
      `材料清单 - ${region} - ${businessType}`,
      checklist,
      businessType,
      region,
      'low'
    );
  } catch (error) {
    console.error('材料清单生成失败:', error);
    await sendMessage(chatId, `❌ 生成失败: ${error.message}`);
  }
}

async function handleMeetingCommand(chatId, args) {
  if (!args) {
    await sendMessage(chatId, '请输入会议主题，例如：\n/meeting 香港公司注册咨询');
    return;
  }

  await sendMessage(chatId, `🤝 正在准备会议速读卡...\n主题: ${args}`);

  try {
    const prep = await generateMeetingPrep(args);
    await sendMessage(chatId, prep);

    await saveRecord(
      `会议速读卡 - ${args}`,
      prep,
      '会议准备',
      null,
      'low'
    );
  } catch (error) {
    console.error('会议速读卡生成失败:', error);
    await sendMessage(chatId, `❌ 生成失败: ${error.message}`);
  }
}

async function runDailyPolicyPush() {
  console.log('� 执行每日政策推送...');

  try {
    const policyItems = await fetchFromGoogleAlerts();

    if (policyItems.length === 0) {
      console.log('今日无新政策更新');
      return;
    }

    const summary = await summarizePolicy(policyItems);

    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
    if (CHAT_ID) {
      await sendMessage(CHAT_ID, `🌅 早上好！这是今日跨境金融政策简报：\n\n${summary}`);
    }

    await saveRecord(
      `政策简报 - ${new Date().toLocaleDateString('zh-CN')}`,
      summary,
      '政策更新',
      '中国',
      'medium'
    );

    console.log('✅ 每日政策推送完成');
  } catch (error) {
    console.error('每日政策推送失败:', error);
  }
}

async function startPolling() {
  console.log('🔄 启动轮询模式...');
  await deleteWebhook();

  let offset = readOffset();
  while (true) {
    try {
      const updates = await getUpdates(offset);
      for (const update of updates) {
        await handleUpdate(update);
        offset = update.update_id + 1;
        writeOffset(offset);
      }
    } catch (error) {
      console.error('轮询异常:', error.message);
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

async function runOnce() {
  console.log('⚡ 单次执行模式...');
  const updates = await getUpdates(0);
  if (updates.length === 0) {
    console.log('没有新消息');
    return;
  }

  let lastUpdateId = 0;
  let processed = 0;
  for (const update of updates) {
    await handleUpdate(update);
    lastUpdateId = update.update_id;
    processed++;
  }

  await confirmUpdates(lastUpdateId);
  writeOffset(lastUpdateId + 1);
  console.log(`✅ 处理了 ${processed} 条消息`);
}

const mode = process.argv[2];

if (mode === '--poll') {
  startPolling();
} else if (mode === '--daily') {
  runDailyPolicyPush();
} else {
  runOnce();
}
