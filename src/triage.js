const { chat, chatJSON } = require('./llm');

const BUSINESS_CATEGORIES = ['开户', 'ODI', '融资', '结算', '税务', '主体搭建', '牌照', '资产配置', '并购', '其他'];
const RISK_LEVELS = ['低', '中', '高'];
const URGENCY_LEVELS = ['参考', '关注', '跟进', '紧急'];
const ENTITY_TYPES = ['贸易型', '投资型', '高净值', '科技企业', '制造业', '矿业/能源', '医疗大健康', '其他'];

async function triage(userInput) {
  const messages = [
    {
      role: 'system',
      content: '你是一名跨境金融业务分诊专家。请对业务问题生成分诊卡，严格按JSON格式返回。'
    },
    {
      role: 'user',
      content: `## 用户输入
${userInput}

## 输出要求（严格按JSON格式）

{
  "category": "从以下选择: ${BUSINESS_CATEGORIES.join('/')}",
  "region": "涉及的辖区/国家，多个用逗号分隔",
  "entity_type": "从以下选择: ${ENTITY_TYPES.join('/')}",
  "stage": "影响的业务环节: 开户/架构/资金出境/税务申报/融资路径/其他",
  "risk_level": "从以下选择: ${RISK_LEVELS.join('/')}",
  "urgency": "从以下选择: ${URGENCY_LEVELS.join('/')}",
  "summary": "一句话概括这个问题的核心",
  "policies_to_check": ["需要查阅的政策/法规，数组"],
  "sop_needed": ["需要匹配的SOP，数组"],
  "missing_info": ["还缺少哪些关键信息，数组"],
  "next_action": "建议的下一步动作",
  "who_to_confirm": "需要找谁确认"
}

只返回JSON，不要其他内容。`
    }
  ];

  const result = await chatJSON(messages);
  return result || {
    category: '其他',
    region: '待确认',
    entity_type: '其他',
    stage: '其他',
    risk_level: '中',
    urgency: '关注',
    summary: '分诊自动识别失败，需人工判断',
    policies_to_check: [],
    sop_needed: [],
    missing_info: ['无法自动分诊，请人工判断'],
    next_action: '人工确认业务类型和辖区',
    who_to_confirm: '直属主管'
  };
}

function formatTriageCard(t) {
  const riskEmoji = { '低': '🟢', '中': '🟡', '高': '🔴' }[t.risk_level] || '🟡';
  const urgencyEmoji = { '参考': '📋', '关注': '👀', '跟进': '⚡', '紧急': '🚨' }[t.urgency] || '👀';

  let card = `🏷️ **业务分诊卡**

━━━━━━━━━━━━━━━━━━
**📌 概要**: ${t.summary}
━━━━━━━━━━━━━━━━━━

**📂 业务分类**: ${t.category}
**🌍 涉及辖区**: ${t.region}
**🏢 主体类型**: ${t.entity_type}
**🔄 影响环节**: ${t.stage}
${riskEmoji} **风险等级**: ${t.risk_level}
${urgencyEmoji} **紧急程度**: ${t.urgency}

`;

  if (t.policies_to_check && t.policies_to_check.length > 0) {
    card += `**📖 需查阅的政策**:\n`;
    t.policies_to_check.forEach(p => { card += `  • ${p}\n`; });
    card += '\n';
  }

  if (t.sop_needed && t.sop_needed.length > 0) {
    card += `**📋 需匹配的SOP**:\n`;
    t.sop_needed.forEach(s => { card += `  • ${s}\n`; });
    card += '\n';
  }

  if (t.missing_info && t.missing_info.length > 0) {
    card += `**❓ 缺少的关键信息**:\n`;
    t.missing_info.forEach(m => { card += `  • ${m}\n`; });
    card += '\n';
  }

  card += `**➡️ 建议下一步**: ${t.next_action}\n`;
  card += `**👤 需确认人**: ${t.who_to_confirm}`;

  return card;
}

async function generateDraft(context, outputType, tone) {
  const messages = [
    {
      role: 'system',
      content: '你是一名跨境金融商务经理，擅长将内部信息转化为专业的对外沟通文档。'
    },
    {
      role: 'user',
      content: `## 内部信息
${context}

## 输出类型
${outputType || '正式邮件'}

## 语气要求
${tone || '专业、简洁、有紧迫感但不失礼貌'}

## 输出要求

请生成一份可以直接发送的${outputType || '正式邮件'}，要求：
1. 使用专业的金融/商务用语
2. 结构清晰，重点突出
3. 包含明确的行动号召（Call to Action）
4. 适当使用项目符号和分段
5. 结尾附上"如需进一步讨论，欢迎随时联系"

直接输出文档内容，不要解释。`
    }
  ];

  try {
    return await chat(messages);
  } catch (error) {
    console.error('商务文档生成失败:', error.message);
    return '商务文档生成失败，请稍后重试。';
  }
}

async function logProject(updateText) {
  const messages = [
    {
      role: 'system',
      content: '你是一名跨境金融项目管理助手。请从项目更新文字中提取结构化信息，严格按JSON格式返回。'
    },
    {
      role: 'user',
      content: `## 更新内容
${updateText}

## 输出要求（严格按JSON格式）

{
  "client_name": "客户名称或代号",
  "project_name": "项目名称",
  "region": "涉及辖区",
  "current_stage": "当前阶段（如: 需求确认/方案设计/材料准备/审批中/执行中/已完成）",
  "progress_summary": "一句话进度摘要",
  "key_milestone": "关键里程碑",
  "next_step": "下一步动作",
  "blocker": "当前阻碍（没有则为null）",
  "deadline": "截止日期（没有则为null）"
}

只返回JSON，不要其他内容。`
    }
  ];

  const result = await chatJSON(messages);
  return result || {
    client_name: '待确认',
    project_name: '待确认',
    region: '待确认',
    current_stage: '待确认',
    progress_summary: updateText,
    key_milestone: null,
    next_step: '人工确认',
    blocker: null,
    deadline: null
  };
}

function formatProjectLog(p) {
  let log = `📝 **项目日志**

**👤 客户**: ${p.client_name}
**📋 项目**: ${p.project_name}
**🌍 辖区**: ${p.region}
**📊 阶段**: ${p.current_stage}
**📌 进度**: ${p.progress_summary}`;

  if (p.key_milestone) log += `\n**🏆 里程碑**: ${p.key_milestone}`;
  if (p.next_step) log += `\n**➡️ 下一步**: ${p.next_step}`;
  if (p.blocker) log += `\n**🚧 阻碍**: ${p.blocker}`;
  if (p.deadline) log += `\n**⏰ 截止**: ${p.deadline}`;

  return log;
}

module.exports = { triage, formatTriageCard, generateDraft, logProject, formatProjectLog, BUSINESS_CATEGORIES, RISK_LEVELS, URGENCY_LEVELS, ENTITY_TYPES };
