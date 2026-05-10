const { chat } = require('./llm');

const SCRIPT_SCENARIOS = {
  '初次接触': {
    context: '客户首次咨询跨境金融业务',
    goal: '了解客户需求，建立信任，引导深入沟通',
    key_points: ['确认客户背景和行业', '了解核心痛点', '初步判断业务类型', '约定下次沟通时间']
  },
  '方案推荐': {
    context: '向客户推荐具体的跨境金融解决方案',
    goal: '清晰展示方案价值，处理异议，推动决策',
    key_points: ['方案核心优势', '与竞品对比', '风险提示', '费用透明', '成功案例引用']
  },
  '异议处理': {
    context: '客户对方案或费用有疑虑',
    goal: '消除顾虑，重建信心，推进合作',
    key_points: ['倾听确认顾虑', '提供数据支撑', '案例佐证', '替代方案', '限时优惠(如有)']
  },
  '签约推进': {
    context: '方案已确认，推动签约',
    goal: '加速签约流程，锁定合作',
    key_points: ['确认签约时间线', '材料清单提醒', '流程说明', '关键节点确认']
  },
  '交付跟进': {
    context: '项目执行中，定期跟进',
    goal: '保持客户满意度，发现新需求',
    key_points: ['进度更新', '问题预警', '下一步计划', '增值服务推荐']
  },
  '续约/增购': {
    context: '现有客户续约或增购服务',
    goal: '提升客户生命周期价值',
    key_points: ['服务回顾', '新政策/新产品', '续约优惠', '增购方案']
  }
};

async function generateScript(scenario, context) {
  const scenarioInfo = SCRIPT_SCENARIOS[scenario] || SCRIPT_SCENARIOS['初次接触'];

  const messages = [
    {
      role: 'system',
      content: `你是一名资深跨境金融商务话术教练。请为以下场景生成专业话术。

场景背景: ${scenarioInfo.context}
沟通目标: ${scenarioInfo.goal}
关键要点: ${scenarioInfo.key_points.join(' / ')}`
    },
    {
      role: 'user',
      content: `## 场景
${scenario}

## 具体背景
${context || '通用跨境金融业务场景'}

## 输出要求

请生成以下内容：

1. **开场白** (3-5句，自然引入话题)
2. **核心话术** (按沟通逻辑分段，每段2-3句)
3. **异议应对** (预判2-3个常见异议及应对)
4. **收尾话术** (推动下一步行动)

要求：
- 用语专业但不生硬
- 体现对客户处境的理解
- 适当使用数据增强说服力
- 避免过度承诺`
    }
  ];

  try {
    return await chat(messages);
  } catch (error) {
    console.error('[SCRIPT] 生成失败:', error.message);
    return '话术生成失败，请稍后重试。';
  }
}

function listScenarios() {
  let text = '🎭 **话术场景列表**\n\n';
  Object.entries(SCRIPT_SCENARIOS).forEach(([name, info]) => {
    text += `**${name}**\n`;
    text += `  目标: ${info.goal}\n`;
    text += `  要点: ${info.key_points.join('、')}\n\n`;
  });
  text += '\n用法: /script 场景名 [具体背景]\n例: /script 方案推荐 香港公司开户ODI';
  return text;
}

module.exports = { generateScript, listScenarios, SCRIPT_SCENARIOS };
