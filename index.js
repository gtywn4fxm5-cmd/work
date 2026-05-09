require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { processMessage } = require('./src/main');
const { getUpdates, confirmUpdates, deleteWebhook, sendMessage } = require('./src/telegram');
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
  例: /triage 香港开户被拒了怎么办

📰 /policy
  每日8:30自动推送，也可手动触发
  含业务路由分析（开户/架构/资金/税务/融资）

📋 /checklist [地区] [业务]
  例: /checklist 迪拜 矿业公司注册
  例: /checklist 新加坡 ODI

🤝 /meeting [主题]
  例: /meeting 迪拜投资架构讨论

📝 /draft [要求]
  将内部信息转为专业对外文档
  例: /draft 将ODI备案清单转成发给客户的邮件
  例: /draft 生成香港公司注册服务报价方案

📌 /log [进度更新]
  记录项目进度，自动提取关键节点
  例: /log 张总迪拜公司注册已拿到审批，下一步安排打款

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
}

async function handleTriageCommand(chatId, input) {
  if (!input || input.startsWith('/')) {
    await sendMessage(chatId, '请输入业务描述，例如：\n/triage 制造业客户要在迪拜设公司');
    return;
  }

  await sendMessage(chatId, '🏷️ 正在生成分诊卡...');

  try {
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
  } catch (error) {
    console.error('分诊失败:', error);
    await sendMessage(chatId, `❌ 分诊失败: ${error.message}`);
  }
}

async function handlePolicyCommand(chatId) {
  await sendMessage(chatId, '🔍 正在扫描政策更新...');

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

async function handleDraftCommand(chatId, args) {
  if (!args) {
    await sendMessage(chatId, '请输入要求，例如：\n/draft 将ODI备案清单转成发给客户的邮件\n/draft 生成香港公司注册报价方案');
    return;
  }

  await sendMessage(chatId, `📝 正在生成商务文档...`);

  try {
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
  } catch (error) {
    console.error('商务文档生成失败:', error);
    await sendMessage(chatId, `❌ 生成失败: ${error.message}`);
  }
}

async function handleLogCommand(chatId, args) {
  if (!args) {
    await sendMessage(chatId, '请输入进度更新，例如：\n/log 张总迪拜公司注册已拿到审批，下一步安排打款');
    return;
  }

  await sendMessage(chatId, '📌 正在记录项目进度...');

  try {
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
  } catch (error) {
    console.error('项目日志记录失败:', error);
    await sendMessage(chatId, `❌ 记录失败: ${error.message}`);
  }
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
