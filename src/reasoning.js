const { chat, chatJSON } = require('./llm');

async function extractFacts(userMessage) {
  const messages = [
    {
      role: 'system',
      content: '你是一个跨境金融信息提取专家。从用户消息中提取关键要素，以JSON格式返回。'
    },
    {
      role: 'user',
      content: `从以下消息中提取关键要素，以JSON格式返回：
- region: 涉及的国家或地区（如"香港"、"迪拜"、"新加坡"），没有则为null
- business_type: 业务类型（如"ODI"、"公司注册"、"银行开户"、"税务筹划"、"融资"），没有则为null
- amount: 涉及的金额或规模，没有则为null
- entity_type: 主体类型（如"企业"、"个人"），没有则为null
- constraints: 特殊约束或条件，没有则为null
- urgency: 紧急程度（高/中/低），默认"中"

用户消息：
${userMessage}

只返回JSON，不要其他内容。`
    }
  ];

  const result = await chatJSON(messages);
  return result || { region: null, business_type: null, amount: null, entity_type: null, constraints: null, urgency: '中' };
}

async function generateDraft(userMessage, facts, knowledgeContext) {
  const messages = [
    {
      role: 'system',
      content: '你是一名资深跨境金融顾问，专精企业出海服务。请基于提供的信息生成专业回答。'
    },
    {
      role: 'user',
      content: `## 用户问题
${userMessage}

## 提取的关键事实
${JSON.stringify(facts, null, 2)}

## 参考知识库内容
${knowledgeContext || '暂无匹配的SOP或案例'}

## 输出要求
请按以下结构输出：

### 📋 可执行结论
（给出明确、可操作的建议，分步骤列出）

### 📎 需要准备的资料
（列出客户需要提供的文件和资料清单）

### ⚠️ 风险点 / 不确定点
（列出可能存在的合规风险、政策变动风险、信息不完整的地方）

### 🔍 下一步建议
（明确指出接下来应该做什么，以及需要人工确认的环节）`
    }
  ];

  return await chat(messages);
}

async function verifyDraft(draft, facts) {
  const messages = [
    {
      role: 'system',
      content: '你是一名跨境金融合规审查员。请审查AI生成的咨询回答，检查是否存在事实错误、合规风险或遗漏。'
    },
    {
      role: 'user',
      content: `## 提取的关键事实
${JSON.stringify(facts, null, 2)}

## AI生成的回答
${draft}

## 审查要求
请检查以下方面并以JSON格式返回：
1. fact_check: 事实是否准确（pass/warning/error）
2. compliance_risk: 合规风险等级（low/medium/high）
3. missing_info: 缺少哪些关键信息（数组）
4. corrections: 需要修正的内容（数组，每项包含 original 和 correction）
5. additional_risks: 额外风险提示（数组）

只返回JSON，不要其他内容。`
    }
  ];

  const result = await chatJSON(messages);
  return result || {
    fact_check: 'warning',
    compliance_risk: 'medium',
    missing_info: ['无法完成自动审查，请人工核实'],
    corrections: [],
    additional_risks: ['AI审查模块异常，建议人工复核全部内容']
  };
}

module.exports = { extractFacts, generateDraft, verifyDraft };
