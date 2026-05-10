const { chat, chatJSON } = require('./llm');
const { Client } = require('@notionhq/client');
const config = require('./config');

const notion = config.notion.apiKey ? new Client({ auth: config.notion.apiKey }) : null;

const PIPELINE_STAGES = ['需求确认', '方案设计', '资源对接', '跟进签约', '交付维护'];

async function createPipeline(userInput) {
  const messages = [
    {
      role: 'system',
      content: '你是一名跨境金融业务流程管理专家。请从用户描述中提取业务链信息，严格按JSON格式返回。'
    },
    {
      role: 'user',
      content: `## 业务描述
${userInput}

## 输出要求（严格按JSON格式）

{
  "client_name": "客户名称",
  "project_name": "项目名称",
  "business_type": "业务类型（开户/ODI/架构搭建/资金出境/税务规划/融资/并购/牌照）",
  "region": "涉及辖区",
  "current_stage": "当前阶段（从以下选择: ${PIPELINE_STAGES.join('/')}）",
  "stage_details": {
    "方案设计": "方案设计阶段的具体内容（如不涉及则为null）",
    "资源对接": "需要对接的资源（如不涉及则为null）",
    "跟进签约": "签约相关进度（如不涉及则为null）",
    "交付维护": "交付维护内容（如不涉及则为null）"
  },
  "key_deliverables": ["关键交付物，数组"],
  "responsible_person": "负责人",
  "deadline": "截止日期（没有则为null）",
  "risk_points": ["风险点，数组"],
  "next_action": "下一步动作",
  "progress_pct": 0
}

只返回JSON，不要其他内容。`
    }
  ];

  const result = await chatJSON(messages);
  return result || {
    client_name: '待确认',
    project_name: '待确认',
    business_type: '其他',
    region: '待确认',
    current_stage: '需求确认',
    stage_details: {},
    key_deliverables: [],
    responsible_person: '待分配',
    deadline: null,
    risk_points: [],
    next_action: '人工确认需求',
    progress_pct: 0
  };
}

function formatPipelineCard(p) {
  const stageIdx = PIPELINE_STAGES.indexOf(p.current_stage);
  const progress = p.progress_pct || (stageIdx >= 0 ? Math.round((stageIdx + 1) / PIPELINE_STAGES.length * 100) : 0);

  let progressBar = '';
  PIPELINE_STAGES.forEach((stage, i) => {
    const icon = i < stageIdx ? '✅' : i === stageIdx ? '🔵' : '⬜';
    progressBar += `${icon} ${stage}\n`;
  });

  let card = `🔗 **业务链跟踪**

━━━━━━━━━━━━━━━━━━
**📌 项目**: ${p.project_name}
**👤 客户**: ${p.client_name}
**💼 类型**: ${p.business_type} | ${p.region}
**📊 进度**: ${progress}%
━━━━━━━━━━━━━━━━━━

**🔄 阶段进度**:
${progressBar}`;

  if (p.stage_details) {
    const details = Object.entries(p.stage_details).filter(([, v]) => v && v !== 'null');
    if (details.length > 0) {
      card += `\n**📋 阶段详情**:\n`;
      details.forEach(([k, v]) => { card += `  • ${k}: ${v}\n`; });
    }
  }

  if (p.key_deliverables && p.key_deliverables.length > 0) {
    card += `\n**📦 关键交付物**:\n`;
    p.key_deliverables.forEach(d => { card += `  • ${d}\n`; });
  }

  if (p.risk_points && p.risk_points.length > 0) {
    card += `\n**⚠️ 风险点**:\n`;
    p.risk_points.forEach(r => { card += `  • ${r}\n`; });
  }

  card += `\n**➡️ 下一步**: ${p.next_action}`;
  if (p.deadline) card += `\n**⏰ 截止**: ${p.deadline}`;

  return card;
}

async function savePipelineToNotion(pipeline) {
  if (!notion || !config.notion.pipelineDbId) {
    console.log('[PIPELINE] Notion未配置，跳过保存');
    return null;
  }

  try {
    const properties = {
      '项目名称': { title: [{ text: { content: pipeline.project_name || '待确认' } }] },
      '客户名称': { rich_text: [{ text: { content: pipeline.client_name || '待确认' } }] },
      '业务类型': { select: { name: pipeline.business_type || '其他' } },
      '辖区': { rich_text: [{ text: { content: pipeline.region || '待确认' } }] },
      '当前阶段': { select: { name: pipeline.current_stage || '需求确认' } },
      '负责人': { rich_text: [{ text: { content: pipeline.responsible_person || '待分配' } }] },
      '进度': { number: pipeline.progress_pct || 0 },
      '创建日期': { date: { start: new Date().toISOString().split('T')[0] } }
    };

    if (pipeline.deadline) {
      properties['截止日期'] = { date: { start: pipeline.deadline } };
    }

    const response = await notion.pages.create({
      parent: { database_id: config.notion.pipelineDbId },
      properties
    });

    return response.url;
  } catch (error) {
    console.error('[PIPELINE] Notion保存失败:', error.message);
    return null;
  }
}

async function queryPipeline(keyword) {
  if (!notion || !config.notion.pipelineDbId) {
    return [];
  }

  try {
    const response = await notion.databases.query({
      database_id: config.notion.pipelineDbId,
      filter: {
        or: [
          { property: '项目名称', title: { contains: keyword } },
          { property: '客户名称', rich_text: { contains: keyword } },
          { property: '业务类型', select: { equals: keyword } }
        ]
      },
      page_size: 5
    });

    return response.results.map(page => ({
      project: page.properties['项目名称']?.title?.[0]?.plain_text || '',
      client: page.properties['客户名称']?.rich_text?.[0]?.plain_text || '',
      type: page.properties['业务类型']?.select?.name || '',
      stage: page.properties['当前阶段']?.select?.name || '',
      progress: page.properties['进度']?.number || 0,
      url: page.url
    }));
  } catch (error) {
    console.error('[PIPELINE] Notion查询失败:', error.message);
    return [];
  }
}

function formatPipelineList(pipelines) {
  if (pipelines.length === 0) return '📭 未找到匹配的业务链';

  let text = `🔗 **业务链查询结果** (${pipelines.length}条)\n\n`;
  pipelines.forEach((p, i) => {
    text += `${i + 1}. **${p.project}** | ${p.client}\n`;
    text += `   ${p.type} | ${p.stage} | ${p.progress}%\n\n`;
  });
  return text;
}

module.exports = { createPipeline, formatPipelineCard, savePipelineToNotion, queryPipeline, formatPipelineList, PIPELINE_STAGES };
