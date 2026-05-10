require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { processMessage } = require('./src/main');
const { getUpdates, confirmUpdates, deleteWebhook, sendMessage, setCommands } = require('./src/telegram');
const { fetchFromGoogleAlerts } = require('./src/policy-scraper');
const { summarizePolicy, generateMeetingPrep, generateChecklist } = require('./src/policy-analyzer');
const { triage, formatTriageCard, generateDraft, logProject, formatProjectLog } = require('./src/triage');
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

  console.log(`收到消息 chatId=${chatId} text="${text}"`);

  try {
    if (text === '/start') {
      await sendMessage(chatId, `🤖 跨境业务分诊系统 v4.0

核心功能（按使用频率排序）：
🏷️ /triage  - 业务分诊卡（分类→路由→风险→动作）
📰 /policy  - 今日政策简报（含业务路由分析）
📋 /checklist - 材料清单+风险检查表
🤝 /meeting - 会议速读卡
📝 /draft   - 商务文档生成（邮件/方案）
📌 /log     - 项目进度记录
❓ /ask     - 业务问答（带风险审查）
📊 /status  - 系统状态

💡 直接发消息 = 自动分诊 + 问答`);
      return;
    }

    if (text === '/help') {
      await sendMessage(chatId, `📖 使用指南

🏷️ /triage [业务描述]
  生成业务分诊卡，自动分类和路由
  例: /triage 制造业客户要在迪拜设公司

📰 /policy
  每日8:30自动推送，也可手动触发

📋 /checklist [地区] [业务]
  例: /checklist 迪拜 矿业公司注册

🤝 /meeting [主题]
  例: /meeting 迪拜投资架构讨论

📝 /draft [要求]
  例: /draft 将ODI备案清单转成发给客户的邮件

📌 /log [进度更新]
  例: /log 张总迪拜公司注册已拿到审批

❓ /ask [问题]
  例: /ask ODI备案需要什么材料`);
      return;
    }

    if (text.startsWith('/triage')) {
      const input = text.replace('/triage', '').trim();
      await handleTriageCommand(chatId, input || text);
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

    if (text.startsWith('/draft')) {
      const args = text.replace('/draft', '').trim();
      await handleDraftCommand(chatId, args);
      return;
    }

    if (text.startsWith('/log')) {
      const args = text.replace('/log', '').trim();
      await handleLogCommand(chatId, args);
      return;
    }

    if (text.startsWith('/ask')) {
      const question = text.replace('/ask', '').trim();
      await processMessage(chatId, question || text);
      return;
    }

    if (text === '/status') {
      await sendMessage(chatId, `📊 系统状态\n\n✅ Telegram Bot: 运行中\n✅ GitHub Actions: 定时执行\n✅ Notion: 已连接\n⏰ 每日政策推送: 8:30 (UTC+8)\n🔀 业务路由: 开户/架构/资金/税务/融资`);
      return;
    }

    await handleTriageCommand(chatId, text);
  } catch (error) {
    console.error(`处理消息失败 chatId=${chatId}:`, error);
    try {
      await sendMessage(chatId, `❌ 处理失败: ${error.message}\n\n请重试或使用 /help 查看帮助。`);
    } catch (sendError) {
      console.error('发送错误消息也失败:', sendError.message);
    }
  }
}

async function handleTriageCommand(chatId, input) {
  if (!input || input.startsWith('/')) {
    await sendMessage(chatId, '请输入业务描述，例如：\n/triage 制造业客户要在迪拜设公司');
    return;
  }

  await sendMessage(chatId, '🏷️ 正在生成分诊卡...');

  const card = await triage(input);
  const formatted = formatTriageCard(card);
  await sendMessage(chatId, formatted);

  await saveRecord(
    `分诊卡 - ${card.category} - ${card.region}`,
    formatted,
    card.category,
    card.region,
    card.risk_level === '高' ? 'high' : card.risk_level === '低' ? 'low' : 'medium'
  );
}

async function handlePolicyCommand(chatId) {
  await sendMessage(chatId, '🔍 正在扫描政策更新...');

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
}

async function handleChecklistCommand(chatId, args) {
  const parts = args.split(/\s+/);
  const region = parts[0] || '通用';
  const businessType = parts.slice(1).join(' ') || '通用';

  await sendMessage(chatId, `📋 正在生成材料清单...\n地区: ${region}\n业务: ${businessType}`);

  const checklist = await generateChecklist(businessType, region);
  await sendMessage(chatId, checklist);

  await saveRecord(
    `材料清单 - ${region} - ${businessType}`,
    checklist,
    businessType,
    region,
    'low'
  );
}

async function handleMeetingCommand(chatId, args) {
  if (!args) {
    await sendMessage(chatId, '请输入会议主题，例如：\n/meeting 香港公司注册咨询');
    return;
  }

  await sendMessage(chatId, `🤝 正在准备会议速读卡...\n主题: ${args}`);

  const prep = await generateMeetingPrep(args);
  await sendMessage(chatId, prep);

  await saveRecord(
    `会议速读卡 - ${args}`,
    prep,
    '会议准备',
    null,
    'low'
  );
}

async function handleDraftCommand(chatId, args) {
  if (!args) {
    await sendMessage(chatId, '请输入要求，例如：\n/draft 将ODI备案清单转成发给客户的邮件');
    return;
  }

  await sendMessage(chatId, `📝 正在生成商务文档...`);

  const outputType = args.includes('邮件') ? '正式邮件' :
                     args.includes('报价') ? '报价方案' :
                     args.includes('方案') ? '服务方案' : '正式邮件';
  const tone = args.includes('催促') ? '专业、有紧迫感' :
               args.includes('友好') ? '友好、温和' : '专业、简洁';

  const draft = await generateDraft(args, outputType, tone);
  await sendMessage(chatId, draft);

  await saveRecord(
    `商务文档 - ${outputType} - ${new Date().toLocaleDateString('zh-CN')}`,
    draft,
    '商务文档',
    null,
    'low'
  );
}

async function handleLogCommand(chatId, args) {
  if (!args) {
    await sendMessage(chatId, '请输入进度更新，例如：\n/log 张总迪拜公司注册已拿到审批');
    return;
  }

  await sendMessage(chatId, '📌 正在记录项目进度...');

  const log = await logProject(args);
  const formatted = formatProjectLog(log);
  await sendMessage(chatId, formatted);

  await saveRecord(
    `项目日志 - ${log.client_name} - ${log.project_name}`,
    formatted,
    '项目日志',
    log.region,
    'low'
  );
}

async function runDailyPolicyPush() {
  console.log('📰 执行每日政策推送...');

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

async function setup() {
  console.log('� 初始化Bot...');
  const whResult = await deleteWebhook();
  console.log('  deleteWebhook:', JSON.stringify(whResult));
  const cmdResult = await setCommands();
  console.log('  setCommands:', JSON.stringify(cmdResult));
}

async function startPolling() {
  console.log('🔄 启动轮询模式...');
  await setup();

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
  console.log('  NODE_ENV:', process.env.NODE_ENV);
  console.log('  GITHUB_TOKEN存在:', !!process.env.GITHUB_TOKEN);
  console.log('  GITHUB_REPOSITORY:', process.env.GITHUB_REPOSITORY);
  console.log('  MODELS_TOKEN存在:', !!process.env.MODELS_TOKEN);
  console.log('  MODELS_TOKEN前10位:', process.env.MODELS_TOKEN?.substring(0, 10));
  console.log('  TELEGRAM_BOT_TOKEN存在:', !!process.env.TELEGRAM_BOT_TOKEN);

  await setup();

  console.log('\n🔑 快速验证LLM Token...');
  const llmToken = process.env.GITHUB_TOKEN || process.env.MODELS_TOKEN;
  console.log('  使用token来源:', process.env.GITHUB_TOKEN ? 'GITHUB_TOKEN(内置)' : 'MODELS_TOKEN');
  try {
    const testResult = await axios.post(
      'https://models.inference.ai.azure.com/chat/completions',
      { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'OK' }], max_tokens: 5 },
      { headers: { 'Authorization': `Bearer ${llmToken}`, 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    console.log('✅ LLM Token有效:', testResult.data.choices[0].message.content);
  } catch (e) {
    console.error('❌ LLM Token无效!');
    console.error('   HTTP状态:', e.response?.status);
    console.error('   错误信息:', e.response?.data?.error?.message || e.message);
  }

  const savedOffset = readOffset();
  console.log(`  已保存的offset: ${savedOffset}`);

  console.log('  正在调用 getUpdates...');
  const updates = await getUpdates(savedOffset);
  console.log(`获取到 ${updates.length} 条消息`);

  if (updates.length === 0) {
    console.log('没有新消息，停止自触发链');
    return;
  }

  for (const u of updates) {
    console.log(`  消息: update_id=${u.update_id} text="${u.message?.text}" chat_id=${u.message?.chat?.id}`);
  }

  let lastUpdateId = 0;
  let processed = 0;
  let failed = 0;

  for (const update of updates) {
    try {
      await handleUpdate(update);
      processed++;
    } catch (error) {
      console.error(`处理消息失败 update_id=${update.update_id}:`, error.message);
      failed++;
    }
    lastUpdateId = update.update_id;
  }

  await confirmUpdates(lastUpdateId);
  const newOffset = lastUpdateId + 1;
  writeOffset(newOffset);
  console.log(`✅ 完成: 成功${processed}条, 失败${failed}条, 新offset=${newOffset}`);
}

const mode = process.argv[2];

if (mode === '--poll') {
  startPolling();
} else if (mode === '--daily') {
  runDailyPolicyPush();
} else {
  runOnce();
}
