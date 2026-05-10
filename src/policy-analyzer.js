const { chat } = require('./llm');

const BUSINESS_ROUTES = [
  { key: '开户', label: '🏦 开户', desc: '影响银行/KYC开户流程' },
  { key: '架构', label: '🏗️ 架构', desc: '影响主体架构搭建' },
  { key: '资金', label: '💰 资金出境', desc: '影响跨境资金流动' },
  { key: '税务', label: '📋 税务', desc: '影响税务申报/筹划' },
  { key: '融资', label: '📈 融资', desc: '影响融资路径/条件' },
  { key: '参考', label: '📎 参考', desc: '仅供参考，不必马上处理' }
];

async function summarizePolicy(policyItems) {
  if (!policyItems || policyItems.length === 0) {
    return '今日无新政策更新。';
  }

  const policyText = policyItems.slice(0, 10).map((item, i) => {
    return `[${i + 1}] ${item.title}\n    来源: ${item.keyword || '政策网站'}\n    日期: ${item.pubDate}\n    摘要: ${item.description || '无'}`;
  }).join('\n\n');

  const messages = [
    {
      role: 'system',
      content: '你是一名跨境金融政策分析师，专精企业出海服务。请对政策/新闻进行业务路由分析。'
    },
    {
      role: 'user',
      content: `## 今日政策/新闻列表

${policyText}

## 输出要求

### 📰 今日跨境金融政策简报
*${new Date().toLocaleDateString('zh-CN')}*

---

**🚨 需要紧急跟进的政策**

（1-3条最重要的，说明：①为什么重要 ②影响哪类客户 ③影响哪个业务环节）

**📋 一般政策更新**

（简要列出其他更新，每条一句话）

---

**🔀 业务路由分析**

请将每条政策归类到以下业务路由中：

| 路由 | 涉及政策 | 影响判断 | 是否需跟进 |
|------|---------|---------|-----------|
| 🏦 开户 | ... | ... | 是/否 |
| 🏗️ 架构 | ... | ... | 是/否 |
| 💰 资金出境 | ... | ... | 是/否 |
| 📋 税务 | ... | ... | 是/否 |
| 📈 融资 | ... | ... | 是/否 |
| 📎 参考 | ... | ... | 否 |

---

**💡 对制造业出海的影响判断**

- ODI备案：是否有变化
- 资金出入境：是否有新限制或便利
- 税务：是否有新规
- 银行开户：是否有影响
- 地区政策：哪些地区有新动态

**✅ 今日建议跟进事项**

（1-3件你今天应该做的事，按优先级排列）`
    }
  ];

  try {
    return await chat(messages);
  } catch (error) {
    console.error('政策摘要生成失败:', error.message);
    return '政策摘要生成失败，请稍后重试。';
  }
}

async function generateMeetingPrep(meetingTopic, clientInfo) {
  const messages = [
    {
      role: 'system',
      content: '你是一名跨境金融商务经理的AI助手。请为会议准备速读卡。'
    },
    {
      role: 'user',
      content: `## 会议信息
- 主题：${meetingTopic}
${clientInfo ? `- 客户信息：${clientInfo}` : ''}

## 输出要求

### 📋 会议速读卡

**🎯 这次会议可能谈什么**
（3-5个核心议题）

**❓ 你要问的5个关键问题**
1. ...
2. ...
3. ...
4. ...
5. ...

**📎 需要准备的3类资料**
1. 必须带的：
2. 最好有的：
3. 备用的：

**⚠️ 最容易被问到的点**
（3-5个客户/老板最可能问你的问题，以及建议回答方向）

**🛡️ 怎么回答比较稳**
（对于不确定的问题，给出安全的回答模板）

**🚩 红线提醒**
（绝对不能承诺/不能说的事项）`
    }
  ];

  try {
    return await chat(messages);
  } catch (error) {
    console.error('会议速读卡生成失败:', error.message);
    return '会议速读卡生成失败，请稍后重试。';
  }
}

async function generateChecklist(businessType, region) {
  const messages = [
    {
      role: 'system',
      content: '你是一名跨境金融合规专家。请为业务生成材料清单和风险检查表。'
    },
    {
      role: 'user',
      content: `## 业务信息
- 业务类型：${businessType || '通用'}
- 目标地区：${region || '通用'}

## 输出要求

### 📋 材料清单

**一、境内企业需提供的资料**
| 序号 | 资料名称 | 是否必须 | 备注 |
|------|---------|---------|------|
| 1    | ...     | 必须    | ...  |

**二、境外需办理的事项**
| 序号 | 事项 | 办理机构 | 预计时间 | 备注 |
|------|------|---------|---------|------|
| 1    | ...  | ...     | ...     | ...  |

**三、资金相关**
- 资金出境路径：
- 所需审批：
- 预计时间：

### ⚠️ 风险检查表

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 主体资质 | ⬜ | ... |
| ODI备案 | ⬜ | ... |
| 税务合规 | ⬜ | ... |
| 外汇登记 | ⬜ | ... |
| 银行开户 | ⬜ | ... |
| 牌照许可 | ⬜ | ... |

### 🔍 常见拒绝原因
1. ...
2. ...
3. ...`
    }
  ];

  try {
    return await chat(messages);
  } catch (error) {
    console.error('材料清单生成失败:', error.message);
    return '材料清单生成失败，请稍后重试。';
  }
}

module.exports = { summarizePolicy, generateMeetingPrep, generateChecklist, BUSINESS_ROUTES };
