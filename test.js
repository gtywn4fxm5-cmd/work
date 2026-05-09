require('dotenv').config();

async function testDesensitize() {
  const { desensitize, restore } = require('./src/desensitize');
  console.log('\n=== 测试脱敏模块 ===');

  const testText = '客户张三，身份证110101199001011234，银行卡6222021234567890123，手机13800138000，金额￥500万';
  const { text, mapping } = desensitize(testText);
  console.log('原文:', testText);
  console.log('脱敏后:', text);
  console.log('映射表:', mapping);
  const restored = restore(text, mapping);
  console.log('还原后:', restored);
  console.log('还原正确:', restored === testText);
}

async function testGemini() {
  const { extractFacts } = require('./src/reasoning');
  console.log('\n=== 测试Gemini事实提取 ===');
  const facts = await extractFacts('香港公司注册需要什么资料？ODI备案怎么办理？');
  console.log('提取结果:', JSON.stringify(facts, null, 2));
}

async function testNotion() {
  const { querySOP } = require('./src/knowledge');
  console.log('\n=== 测试Notion查询 ===');
  const results = await querySOP('香港', null);
  console.log('查询结果:', JSON.stringify(results, null, 2));
}

async function testTelegram() {
  const { getUpdates } = require('./src/telegram');
  console.log('\n=== 测试Telegram连接 ===');
  const updates = await getUpdates(0);
  console.log('获取到更新数:', updates.length);
}

async function runTests() {
  try {
    await testDesensitize();
    await testTelegram();
    await testNotion();
    await testGemini();
    console.log('\n✅ 所有测试完成');
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
  }
}

runTests();
