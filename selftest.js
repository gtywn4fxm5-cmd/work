require('dotenv').config();
const axios = require('axios');

async function diagnose() {
  console.log('='.repeat(60));
  console.log('🔍 系统诊断 (GitHub Models + GPT-4o Mini)');
  console.log('='.repeat(60));

  const results = [];

  console.log('\n📋 第1步：检查环境变量');
  const envCheck = {
    MODELS_TOKEN: !!process.env.MODELS_TOKEN,
    NOTION_API_KEY: !!process.env.NOTION_API_KEY,
    NOTION_DATABASE_ID: !!process.env.NOTION_DATABASE_ID,
    TELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: !!process.env.TELEGRAM_CHAT_ID
  };
  console.log('  环境变量状态:', envCheck);
  results.push({ name: '环境变量', passed: Object.values(envCheck).every(v => v) });

  console.log('\n📋 第2步：测试Telegram Bot连接');
  try {
    const botInfo = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`);
    console.log('  Bot信息:', botInfo.data.result.username);
    results.push({ name: 'Telegram Bot', passed: true });
  } catch (e) {
    console.log('  ❌ Bot连接失败:', e.message);
    results.push({ name: 'Telegram Bot', passed: false });
  }

  console.log('\n📋 第3步：检查Webhook状态');
  try {
    const webhookInfo = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
    console.log('  Webhook URL:', webhookInfo.data.result.url || '(未设置)');
    results.push({ name: 'Webhook状态', passed: !webhookInfo.data.result.url });
  } catch (e) {
    console.log('  ❌ Webhook检查失败:', e.message);
    results.push({ name: 'Webhook状态', passed: false });
  }

  console.log('\n📋 第4步：获取待处理消息');
  try {
    const updates = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUpdates`, {
      params: { offset: 0, timeout: 5 }
    });
    const updateList = updates.data.result || [];
    console.log('  待处理消息数:', updateList.length);
    results.push({ name: '获取消息', passed: true });
  } catch (e) {
    console.log('  ❌ 获取消息失败:', e.message);
    results.push({ name: '获取消息', passed: false });
  }

  console.log('\n📋 第5步：检查命令菜单');
  try {
    const commands = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMyCommands`);
    console.log('  已注册命令数:', commands.data.result?.length || 0);
    results.push({ name: '命令菜单', passed: (commands.data.result?.length || 0) > 0 });
  } catch (e) {
    console.log('  ❌ 检查命令失败:', e.message);
    results.push({ name: '命令菜单', passed: false });
  }

  console.log('\n📋 第6步：测试发送消息');
  try {
    const sendResult = await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: '🔧 系统诊断测试 (GitHub Models版本)\n\n如果看到这条消息，说明Telegram发送正常。'
    });
    console.log('  发送结果:', sendResult.data.ok ? '成功' : '失败');
    results.push({ name: '发送消息', passed: sendResult.data.ok });
  } catch (e) {
    console.log('  ❌ 发送失败:', e.response?.data?.description || e.message);
    results.push({ name: '发送消息', passed: false });
  }

  console.log('\n📋 第7步：测试GitHub Models API (GPT-4o Mini)');
  try {
    const r = await axios.post(
      'https://models.inference.ai.azure.com/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: '回复OK' }],
        max_tokens: 10
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.MODELS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    const text = r.data.choices?.[0]?.message?.content;
    console.log('  ✅ GPT-4o Mini 可用! 回复:', text);
    results.push({ name: 'GitHub Models API', passed: true });
  } catch (e) {
    console.log('  ❌ GitHub Models失败:', e.response?.status, e.response?.data?.error?.message || e.message);
    results.push({ name: 'GitHub Models API', passed: false });
  }

  console.log('\n📋 第8步：测试Notion连接');
  try {
    const { Client } = require('@notionhq/client');
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const db = await notion.databases.retrieve({ database_id: process.env.NOTION_DATABASE_ID });
    console.log('  数据库:', db.title[0]?.plain_text || '(无标题)');
    results.push({ name: 'Notion连接', passed: true });
  } catch (e) {
    console.log('  ❌ Notion连接失败:', e.message);
    results.push({ name: 'Notion连接', passed: false });
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 诊断结果汇总');
  console.log('='.repeat(60));
  results.forEach(r => {
    console.log(`  ${r.passed ? '✅' : '❌'} ${r.name}`);
  });
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\n通过: ${passed}/${results.length}, 失败: ${failed}/${results.length}`);

  if (failed > 0) {
    console.log('\n⚠️ 存在问题，请检查上方日志');
    process.exit(1);
  } else {
    console.log('\n🎉 所有检查通过！');
  }
}

diagnose().catch(e => {
  console.error('诊断异常:', e);
  process.exit(1);
});
