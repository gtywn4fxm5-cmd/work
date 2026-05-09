const { desensitize, restore } = require('./desensitize');
const { querySOP, searchKnowledge, saveRecord } = require('./knowledge');
const { extractFacts, generateDraft, verifyDraft } = require('./reasoning');
const { buildRiskReport, needsHumanReview } = require('./verification');
const { sendMessage } = require('./telegram');

async function processMessage(chatId, userMessage) {
  console.log(`[INPUT] 收到消息: ${userMessage}`);

  await sendMessage(chatId, '⏳ 正在处理...');

  try {
    console.log('[PREPROCESS] 第1步：脱敏处理');
    const { text: safeText, mapping } = desensitize(userMessage);

    console.log('[REASONING] 第2步：提取关键事实');
    const facts = await extractFacts(safeText);
    console.log('[REASONING] 提取结果:', JSON.stringify(facts));

    console.log('[KNOWLEDGE] 第3步：查询知识库');
    let knowledgeContext = '';
    if (facts.region || facts.business_type) {
      const sopResults = await querySOP(facts.region, facts.business_type);
      if (sopResults.length > 0) {
        knowledgeContext = sopResults.map(r => `[${r.category}] ${r.title} (${r.region})`).join('\n');
      }
    }
    const searchResults = await searchKnowledge(facts.business_type || '');
    if (searchResults.length > 0) {
      knowledgeContext += '\n' + searchResults.map(r => `[${r.category}] ${r.title}`).join('\n');
    }

    console.log('[REASONING] 第4步：生成草案');
    const draft = await generateDraft(safeText, facts, knowledgeContext);

    console.log('[VERIFICATION] 第5步：审查验证');
    const verification = await verifyDraft(draft, facts);
    const { report, riskLevel } = buildRiskReport(facts, verification);

    let finalDraft = restore(draft, mapping);
    let finalReport = restore(report, mapping);

    const humanReviewNeeded = needsHumanReview(facts, verification);
    if (humanReviewNeeded) {
      finalReport += '\n\n🚨 **此回答需要人工审核后再提供给客户**';
    }

    console.log('[OUTPUT] 第6步：输出结果');
    const reply = `${finalDraft}${finalReport}`;

    await sendMessage(chatId, reply);

    const title = `${facts.business_type || '咨询'} - ${facts.region || '通用'} - ${new Date().toLocaleDateString('zh-CN')}`;
    const notionUrl = await saveRecord(title, finalDraft + '\n\n' + finalReport, facts.business_type, facts.region, riskLevel);

    if (notionUrl) {
      await sendMessage(chatId, `📝 已归档到Notion: ${notionUrl}`);
    }

    console.log('[OUTPUT] 处理完成');
    return { success: true, riskLevel, humanReviewNeeded };
  } catch (error) {
    console.error('[ERROR] 处理失败:', error);
    await sendMessage(chatId, `❌ 处理失败: ${error.message}\n\n请稍后重试，或联系管理员。`);
    return { success: false, error: error.message };
  }
}

module.exports = { processMessage };
