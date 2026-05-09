function buildRiskReport(facts, verification) {
  const riskLevel = verification.compliance_risk || 'medium';
  const emoji = { low: '🟢', medium: '🟡', high: '🔴' }[riskLevel] || '🟡';

  let report = `\n\n---\n📊 **风险审查报告** ${emoji}\n\n`;

  report += `**事实核查**: ${verification.fact_check === 'pass' ? '✅ 通过' : verification.fact_check === 'warning' ? '⚠️ 需注意' : '❌ 存在问题'}\n`;
  report += `**合规风险**: ${emoji} ${riskLevel.toUpperCase()}\n\n`;

  if (verification.missing_info && verification.missing_info.length > 0) {
    report += `**缺失信息**:\n`;
    verification.missing_info.forEach(item => {
      report += `  - ${item}\n`;
    });
    report += '\n';
  }

  if (verification.corrections && verification.corrections.length > 0) {
    report += `**修正建议**:\n`;
    verification.corrections.forEach(item => {
      report += `  - 原文: ${item.original}\n`;
      report += `    修正: ${item.correction}\n`;
    });
    report += '\n';
  }

  if (verification.additional_risks && verification.additional_risks.length > 0) {
    report += `**额外风险提示**:\n`;
    verification.additional_risks.forEach(item => {
      report += `  - ⚠️ ${item}\n`;
    });
    report += '\n';
  }

  report += `> ⚡ 此报告由AI自动生成，仅供参考。关键决策请以人工判断为准。`;

  return { report, riskLevel };
}

function needsHumanReview(facts, verification) {
  if (verification.compliance_risk === 'high') return true;
  if (verification.fact_check === 'error') return true;
  if (facts.amount && parseAmount(facts.amount) > 10000000) return true;
  if (facts.region && ['伊朗', '朝鲜', '叙利亚', '俄罗斯'].includes(facts.region)) return true;
  return false;
}

function parseAmount(amountStr) {
  if (!amountStr) return 0;
  const num = parseFloat(amountStr.replace(/[^0-9.]/g, ''));
  if (amountStr.includes('亿')) return num * 100000000;
  if (amountStr.includes('万')) return num * 10000;
  return num;
}

module.exports = { buildRiskReport, needsHumanReview };
