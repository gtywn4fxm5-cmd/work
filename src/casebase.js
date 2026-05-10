const { chat, chatJSON } = require('./llm');
const { Client } = require('@notionhq/client');
const config = require('./config');

const notion = config.notion.apiKey ? new Client({ auth: config.notion.apiKey }) : null;

const CASE_CATEGORIES = ['开户', 'ODI', '架构搭建', '资金出境', '税务规划', '融资', '并购', '牌照'];

async function searchCase(keyword, category) {
  if (notion && config.notion.caseDbId) {
    return await searchCaseFromNotion(keyword, category);
  }
  return await generateCaseFromLLM(keyword, category);
}

async function searchCaseFromNotion(keyword, category) {
  try {
    const filters = [];
    if (category) {
      filters.push({ property: '业务类型', select: { equals: category } });
    }
    if (keyword) {
      filters.push({
        or: [
          { property: '标题', title: { contains: keyword } },
          { property: '问题', rich_text: { contains: keyword } },
          { property: '解决方案', rich_text: { contains: keyword } }
        ]
      });
    }

    const response = await notion.databases.query({
      database_id: config.notion.caseDbId,
      filter: filters.length > 0 ? { and: filters } : undefined,
      page_size: 5
    });

    const cases = response.results.map(page => ({
      title: page.properties['标题']?.title?.[0]?.plain_text || '',
      category: page.properties['业务类型']?.select?.name || '',
      client_type: page.properties['客户类型']?.select?.name || '',
      problem: page.properties['问题']?.rich_text?.[0]?.plain_text || '',
      solution: page.properties['解决方案']?.rich_text?.[0]?.plain_text || '',
      result: page.properties['结果']?.rich_text?.[0]?.plain_text || '',
      url: page.url
    }));

    if (cases.length > 0) return cases;
  } catch (error) {
    console.error('[CASE] Notion查询失败:', error.message);
  }

  return await generateCaseFromLLM(keyword, category);
}

async function generateCaseFromLLM(keyword, category) {
  const messages = [
    {
      role: 'system',
      content: '你是一名跨境金融案例库专家。请根据关键词生成典型的案例/FAQ/解决方案。'
    },
    {
      role: 'user',
      content: `## 查询关键词
${keyword || '跨境金融'}

## 业务类型
${category || '通用'}

## 输出要求（严格按JSON格式）

{
  "cases": [
    {
      "title": "案例标题",
      "client_type": "客户类型（如: 制造业中型企业/高净值个人/科技公司）",
      "problem": "客户遇到的问题",
      "solution": "我们的解决方案",
      "result": "最终结果",
      "key_learning": "关键经验"
    }
  ],
  "faqs": [
    {
      "question": "常见问题",
      "answer": "标准回答",
      "tips": "沟通技巧"
    }
  ]
}

生成2-3个典型案例和2-3个FAQ。只返回JSON。`
    }
  ];

  const result = await chatJSON(messages);
  return result || { cases: [], faqs: [] };
}

function formatCaseResult(data) {
  let text = '';

  if (Array.isArray(data)) {
    if (data.length === 0) return '📭 未找到匹配的案例';

    data.forEach(c => {
      if (c.title) {
        text += `📌 **${c.title}**\n`;
        if (c.client_type) text += `👤 客户: ${c.client_type}\n`;
        if (c.problem) text += `❓ 问题: ${c.problem}\n`;
        if (c.solution) text += `✅ 方案: ${c.solution}\n`;
        if (c.result) text += `📊 结果: ${c.result}\n`;
        if (c.url) text += `🔗 ${c.url}\n`;
        text += '\n';
      }
    });
  } else {
    if (data.cases && data.cases.length > 0) {
      text += '📌 **典型案例**\n\n';
      data.cases.forEach((c, i) => {
        text += `${i + 1}. **${c.title}**\n`;
        text += `   👤 ${c.client_type}\n`;
        text += `   ❓ ${c.problem}\n`;
        text += `   ✅ ${c.solution}\n`;
        text += `   📊 ${c.result}\n`;
        if (c.key_learning) text += `   💡 ${c.key_learning}\n`;
        text += '\n';
      });
    }

    if (data.faqs && data.faqs.length > 0) {
      text += '❓ **常见问题**\n\n';
      data.faqs.forEach((f, i) => {
        text += `${i + 1}. **Q: ${f.question}**\n`;
        text += `   A: ${f.answer}\n`;
        if (f.tips) text += `   💡 ${f.tips}\n`;
        text += '\n';
      });
    }
  }

  return text || '📭 未找到匹配的案例';
}

async function saveCaseToNotion(caseData) {
  if (!notion || !config.notion.caseDbId) {
    console.log('[CASE] Notion未配置，跳过保存');
    return null;
  }

  try {
    const properties = {
      '标题': { title: [{ text: { content: caseData.title || '未命名案例' } }] },
      '业务类型': { select: { name: caseData.category || '其他' } },
      '客户类型': { select: { name: caseData.client_type || '其他' } },
      '问题': { rich_text: [{ text: { content: caseData.problem || '' } }] },
      '解决方案': { rich_text: [{ text: { content: caseData.solution || '' } }] },
      '结果': { rich_text: [{ text: { content: caseData.result || '' } }] },
      '创建日期': { date: { start: new Date().toISOString().split('T')[0] } }
    };

    const response = await notion.pages.create({
      parent: { database_id: config.notion.caseDbId },
      properties
    });

    return response.url;
  } catch (error) {
    console.error('[CASE] Notion保存失败:', error.message);
    return null;
  }
}

module.exports = { searchCase, formatCaseResult, saveCaseToNotion, CASE_CATEGORIES };
