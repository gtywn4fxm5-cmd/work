const { chat, chatJSON } = require('./llm');

const MATERIAL_TEMPLATES = {
  '开户': {
    company: ['营业执照', '公司章程', '董事名册', '股东名册', '注册证书', '良好存续证明'],
    shareholder: ['股东身份证/护照', '股东地址证明', '持股比例说明', '最终受益人声明'],
    business: ['业务计划书', '交易对手方信息', '预计交易量说明', '资金来源说明'],
    fund: ['资金用途说明', '初始存款来源证明', '预计账户流水'],
    tax: ['税务居民身份声明', 'CRS/FATCA自评表'],
    pricing: ['银行开户费用', '账户管理费', '转账手续费'],
    contract: ['银行服务协议', '账户条款']
  },
  'ODI': {
    company: ['营业执照', '组织机构代码证', '税务登记证', '公司章程', '审计报告(最近2年)'],
    shareholder: ['股东身份证', '股东决议', '出资证明', '股权结构图'],
    business: ['境外投资可行性报告', '投资环境分析', '项目说明书', '并购协议(如适用)'],
    fund: ['资金来源说明', '外汇登记申请', '资金出境路径说明', '银行流水'],
    tax: ['企业完税证明', '税收居民身份证明', '境外税务影响分析'],
    pricing: ['ODI备案费用', '律师费', '审计费', '公证费'],
    contract: ['投资协议', '股东协议', '章程修正案']
  },
  '架构搭建': {
    company: ['母公司营业执照', '集团架构图', '关联公司清单', '审计报告'],
    shareholder: ['实控人身份资料', 'UBO声明', '代持协议(如适用)'],
    business: ['架构设计方案', '商业合理性说明', '税务效率分析', '合规性评估'],
    fund: ['注册资本说明', '出资计划', '资金调拨路径'],
    tax: ['转让定价分析', 'CFC规则评估', '税收协定适用分析', 'BEPS合规评估'],
    pricing: ['架构咨询费', '注册费', '年审费', '秘书服务费'],
    contract: ['架构设计服务协议', '注册代理协议', '秘书服务协议']
  },
  '融资': {
    company: ['营业执照', '公司章程', '审计报告(3年)', '财务报表', '商业计划书'],
    shareholder: ['股东身份资料', '股权结构', '管理层简历', '实控人征信'],
    business: ['融资方案', '资金用途明细', '还款计划', '担保方案', '项目可行性报告'],
    fund: ['融资额度', '期限要求', '利率预期', '资金到账时间'],
    tax: ['利息预提税分析', '融资税务成本测算', '税收协定优惠适用'],
    pricing: ['融资利率', '安排费', '法律费', '评估费', '保险费'],
    contract: ['贷款协议', '担保协议', '抵押协议', '承诺函']
  },
  '通用': {
    company: ['营业执照', '公司章程', '注册证书'],
    shareholder: ['股东身份资料', '持股比例说明'],
    business: ['业务说明', '交易背景'],
    fund: ['资金来源说明', '资金用途说明'],
    tax: ['税务居民身份声明'],
    pricing: ['服务报价'],
    contract: ['服务协议']
  }
};

async function generateMaterialList(businessType, region) {
  const template = MATERIAL_TEMPLATES[businessType] || MATERIAL_TEMPLATES['通用'];

  const messages = [
    {
      role: 'system',
      content: '你是一名跨境金融材料清单专家。请根据业务类型和辖区，生成详细的材料清单。'
    },
    {
      role: 'user',
      content: `## 业务类型
${businessType}

## 涉及辖区
${region || '通用'}

## 基础模板
${JSON.stringify(template, null, 2)}

## 输出要求

请基于以上模板，结合辖区特殊要求，生成一份完整的材料清单。格式如下：

对每个类别，列出：
1. 材料名称
2. 是否必须（必须/推荐/可选）
3. 特别说明（如辖区特殊要求）

请用清晰的格式输出，方便客户对照准备。`
    }
  ];

  try {
    return await chat(messages);
  } catch (error) {
    console.error('[MATERIAL] 生成失败:', error.message);
    return formatBasicMaterialList(template);
  }
}

function formatBasicMaterialList(template) {
  const categoryNames = {
    company: '🏢 公司资料',
    shareholder: '👤 股东资料',
    business: '📋 业务说明',
    fund: '💰 资金用途',
    tax: '📑 税务信息',
    pricing: '💵 方案报价',
    contract: '📄 合同结构'
  };

  let text = '📋 **材料清单**\n\n';

  Object.entries(template).forEach(([key, items]) => {
    text += `${categoryNames[key] || key}:\n`;
    items.forEach(item => {
      text += `  ☐ ${item}\n`;
    });
    text += '\n';
  });

  return text;
}

module.exports = { generateMaterialList, formatBasicMaterialList, MATERIAL_TEMPLATES };
