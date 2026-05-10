const { chat, chatJSON } = require('./llm');
const { Client } = require('@notionhq/client');
const config = require('./config');

const notion = config.notion.apiKey ? new Client({ auth: config.notion.apiKey }) : null;

async function createProfile(userInput) {
  const messages = [
    {
      role: 'system',
      content: '你是一名跨境金融客户画像分析专家。请从用户描述中提取结构化客户画像，严格按JSON格式返回。'
    },
    {
      role: 'user',
      content: `## 客户描述
${userInput}

## 输出要求（严格按JSON格式）

{
  "client_name": "客户名称/代号",
  "industry": "行业（如: 制造业/科技/矿业/医疗/贸易/投资/其他）",
  "scale": "规模（如: 初创/中小/中型/大型/超大型）",
  "region_origin": "客户所在国家/地区",
  "region_target": "目标国家/地区",
  "business_need": "核心需求（如: 开户/ODI/架构搭建/资金出境/税务规划/融资/并购/牌照）",
  "reason": "驱动原因（如: 市场拓展/税务优化/资产配置/合规要求/融资需求）",
  "entity_type": "主体类型（贸易型/投资型/高净值/科技企业/制造业/矿业能源/医疗大健康/其他）",
  "estimated_revenue": "预估业务规模（如: 100万-500万美元/500万-5000万/5000万+）",
  "risk_level": "风险等级（低/中/高）",
  "key_contacts": "关键联系人角色（如: CFO/CEO/法务/财务总监）",
  "timeline": "时间要求（如: 紧急/1个月内/3个月内/6个月内/待定）",
  "notes": "补充备注"
}

只返回JSON，不要其他内容。`
    }
  ];

  const result = await chatJSON(messages);
  return result || {
    client_name: '待确认',
    industry: '待确认',
    scale: '待确认',
    region_origin: '待确认',
    region_target: '待确认',
    business_need: '待确认',
    reason: '待确认',
    entity_type: '其他',
    estimated_revenue: '待确认',
    risk_level: '中',
    key_contacts: '待确认',
    timeline: '待定',
    notes: userInput
  };
}

function formatProfileCard(p) {
  const riskEmoji = { '低': '🟢', '中': '🟡', '高': '🔴' }[p.risk_level] || '🟡';

  let card = `👤 **客户画像**

━━━━━━━━━━━━━━━━━━
**📌 客户**: ${p.client_name}
**🏭 行业**: ${p.industry}
**📊 规模**: ${p.scale}
━━━━━━━━━━━━━━━━━━

**📍 所在地**: ${p.region_origin}
**🎯 目标地**: ${p.region_target}
**💼 核心需求**: ${p.business_need}
**🔑 驱动原因**: ${p.reason}
**🏢 主体类型**: ${p.entity_type}
**💰 预估规模**: ${p.estimated_revenue}
${riskEmoji} **风险等级**: ${p.risk_level}
**👤 关键联系人**: ${p.key_contacts}
**⏰ 时间要求**: ${p.timeline}`;

  if (p.notes) card += `\n\n**📝 备注**: ${p.notes}`;

  return card;
}

async function saveProfileToNotion(profile) {
  if (!notion || !config.notion.profileDbId) {
    console.log('[PROFILE] Notion未配置，跳过保存');
    return null;
  }

  try {
    const properties = {
      '客户名称': { title: [{ text: { content: profile.client_name || '待确认' } }] },
      '行业': { select: { name: profile.industry || '其他' } },
      '规模': { select: { name: profile.scale || '待确认' } },
      '所在地': { rich_text: [{ text: { content: profile.region_origin || '待确认' } }] },
      '目标地': { rich_text: [{ text: { content: profile.region_target || '待确认' } }] },
      '核心需求': { select: { name: profile.business_need || '其他' } },
      '驱动原因': { rich_text: [{ text: { content: profile.reason || '待确认' } }] },
      '主体类型': { select: { name: profile.entity_type || '其他' } },
      '风险等级': { select: { name: profile.risk_level || '中' } },
      '时间要求': { select: { name: profile.timeline || '待定' } },
      '创建日期': { date: { start: new Date().toISOString().split('T')[0] } }
    };

    const response = await notion.pages.create({
      parent: { database_id: config.notion.profileDbId },
      properties
    });

    return response.url;
  } catch (error) {
    console.error('[PROFILE] Notion保存失败:', error.message);
    return null;
  }
}

async function queryProfile(keyword) {
  if (!notion || !config.notion.profileDbId) {
    return [];
  }

  try {
    const response = await notion.databases.query({
      database_id: config.notion.profileDbId,
      filter: {
        or: [
          { property: '客户名称', title: { contains: keyword } },
          { property: '行业', select: { equals: keyword } },
          { property: '核心需求', select: { equals: keyword } }
        ]
      },
      page_size: 5
    });

    return response.results.map(page => ({
      name: page.properties['客户名称']?.title?.[0]?.plain_text || '',
      industry: page.properties['行业']?.select?.name || '',
      scale: page.properties['规模']?.select?.name || '',
      need: page.properties['核心需求']?.select?.name || '',
      region: page.properties['目标地']?.rich_text?.[0]?.plain_text || '',
      risk: page.properties['风险等级']?.select?.name || '',
      url: page.url
    }));
  } catch (error) {
    console.error('[PROFILE] Notion查询失败:', error.message);
    return [];
  }
}

function formatProfileList(profiles) {
  if (profiles.length === 0) return '📭 未找到匹配的客户画像';

  let text = `🔍 **客户画像查询结果** (${profiles.length}条)\n\n`;
  profiles.forEach((p, i) => {
    const riskEmoji = { '低': '🟢', '中': '🟡', '高': '🔴' }[p.risk] || '🟡';
    text += `${i + 1}. **${p.name}** | ${p.industry} | ${p.scale}\n`;
    text += `   ${p.need} → ${p.region} ${riskEmoji}${p.risk}\n\n`;
  });
  return text;
}

module.exports = { createProfile, formatProfileCard, saveProfileToNotion, queryProfile, formatProfileList };
