require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { processMessage } = require('./src/main');
const { getUpdates, confirmUpdates, deleteWebhook, sendMessage } = require('./src/telegram');

const POLL_MODE = process.argv.includes('--poll');
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
  const text = message.text;

  if (text.startsWith('/start')) {
    await sendMessage(chatId, `🤖 跨境金融AI助手 v2.0

我可以帮你：
📋 跨境架构方案设计
🔍 法规政策查询（ODI/CRS/FATCA）
📊 银行准入与开户流程
⚠️ 合规风险评估
📝 文档摘要与翻译

直接发送你的问题即可！

示例：
• 香港公司注册需要什么资料？
• ODI备案流程是什么？
• 新加坡银行开户要求`);
    return;
  }

  if (text.startsWith('/help')) {
    await sendMessage(chatId, `使用说明：

1️⃣ 直接发送问题，AI会自动：
   - 提取关键信息
   - 查询知识库
   - 生成专业回答
   - 进行风险审查

2️⃣ 回答包含四个部分：
   📋 可执行结论
   📎 需准备的资料
   ⚠️ 风险点
   🔍 下一步建议

3️⃣ 所有回答自动保存到Notion`);
    return;
  }

  await processMessage(chatId, text);
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
  console.log('⚡ 单次执行模式（GitHub Actions）...');

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

if (POLL_MODE) {
  startPolling();
} else {
  runOnce();
}
