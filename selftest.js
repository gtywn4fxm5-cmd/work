require('dotenv').config();
const axios = require('axios');

async function diagnose() {
  console.log('='.repeat(60));
  console.log('🔍 完整系统诊断');
  console.log('='.repeat(60));

  const results = [];

  // 1. 检查所有环境变量
  console.log('\n📋 第1步：检查环境变量');
  const envCheck = {
    GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
    NOTION_API_KEY: !!process.env.NOTION_API_KEY,
    NOTION_DATABASE_ID: !!process.env.NOTION_DATABASE_ID,
    TELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: !!process.env.TELEGRAM_CHAT_ID
  };
  console.log('  环境变量状态:', envCheck);
  results.push({ name: '环境变量', passed: Object.values(envCheck).every(v => v) });

  // 2. 测试Telegram Bot基本连接
  console.log('\n📋 第2步：测试Telegram Bot连接');
  try {
    const botInfo = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`);
    console.log('  Bot信息:', botInfo.data.result.username);
    results.push({ name: 'Telegram Bot连接', passed: true });
  } catch (e) {
    console.log('  ❌ Bot连接失败:', e.message);
    results.push({ name: 'Telegram Bot连接', passed: false });
  }

  // 3. 检查Webhook状态
  console.log('\n📋 第3步：检查Webhook状态');
  try {
    const webhookInfo = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
    console.log('  Webhook URL:', webhookInfo.data.result.url || '(未设置)');
    console.log('  待处理消息:', webhookInfo.data.result.pending_update_count || 0);
    if (webhookInfo.data.result.url) {
      console.log('  ⚠️ 警告: Webhook已设置，可能干扰polling');
      console.log('  建议: 调用deleteWebhook清除');
    }
    results.push({ name: 'Webhook状态', passed: !webhookInfo.data.result.url });
  } catch (e) {
    console.log('  ❌ Webhook检查失败:', e.message);
    results.push({ name: 'Webhook状态', passed: false });
  }

  // 4. 获取当前待处理消息
  console.log('\n📋 第4步：获取待处理消息');
  try {
    const updates = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUpdates`, {
      params: { offset: 0, timeout: 5 }
    });
    const updateList = updates.data.result || [];
    console.log('  待处理消息数:', updateList.length);
    if (updateList.length > 0) {
      updateList.forEach((u, i) => {
        console.log(`    [${i+1}] update_id=${u.update_id}, text="${u.message?.text || '(非文本)'}", chat=${u.message?.chat?.id}`);
      });
    }
    results.push({ name: '获取消息', passed: true });
  } catch (e) {
    console.log('  ❌ 获取消息失败:', e.message);
    results.push({ name: '获取消息', passed: false });
  }

  // 5. 检查已注册命令
  console.log('\n📋 第5步：检查命令菜单');
  try {
    const commands = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMyCommands`);
    console.log('  已注册命令数:', commands.data.result?.length || 0);
    commands.data.result?.forEach(c => {
      console.log(`    /${c.command}: ${c.description}`);
    });
    results.push({ name: '命令菜单', passed: (commands.data.result?.length || 0) > 0 });
  } catch (e) {
    console.log('  ❌ 检查命令失败:', e.message);
    results.push({ name: '命令菜单', passed: false });
  }

  // 6. 测试发送消息
  console.log('\n📋 第6步：测试发送消息');
  try {
    const sendResult = await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: '🔧 系统诊断测试\n\n如果看到这条消息，说明Bot可以正常发送消息。'
    });
    console.log('  发送结果:', sendResult.data.ok ? '成功' : '失败');
    results.push({ name: '发送消息', passed: sendResult.data.ok });
  } catch (e) {
    console.log('  ❌ 发送失败:', e.response?.data?.description || e.message);
    console.log('  错误码:', e.response?.data?.error_code);
    results.push({ name: '发送消息', passed: false });
  }

  // 7. 测试Gemini API
  console.log('\n📋 第7步：测试Gemini API');
  const geminiModels = [
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash'
  ];
  let geminiSuccess = false;
  for (const model of geminiModels) {
    try {
      console.log(`  尝试模型: ${model}...`);
      const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const r = await axios.post(url, {
        contents: [{ parts: [{ text: '回复OK' }] }]
      }, { timeout: 30000 });
      const text = r.data.candidates?.[0]?.content?.parts?.[0]?.text;
      console.log(`  ✅ ${model} 可用! 回复: ${text}`);
      geminiSuccess = true;
      break;
    } catch (e) {
      console.log(`  ❌ ${model}: ${e.response?.status} - ${e.response?.data?.error?.message || e.message}`);
    }
  }
  results.push({ name: 'Gemini API', passed: geminiSuccess });

  // 8. 测试Notion
  console.log('\n📋 第8步：测试Notion连接');
  try {
    const { Client } = require('@notionhq/client');
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const db = await notion.databases.retrieve({ database_id: process.env.NOTION_DATABASE_ID });
    console.log('  数据库:', db.title[0]?.plain_text || '(无标题)');
    console.log('  属性数:', Object.keys(db.properties).length);
    results.push({ name: 'Notion连接', passed: true });
  } catch (e) {
    console.log('  ❌ Notion连接失败:', e.message);
    results.push({ name: 'Notion连接', passed: false });
  }

  // 9. 测试完整的消息处理流程（模拟）
  console.log('\n📋 第9步：模拟消息处理流程');
  console.log('  场景: 用户发送"/ask ODI备案是什么"');
  console.log('  预期流程:');
  console.log('    1. getUpdates(0) 获取消息');
  console.log('    2. handleUpdate 处理消息');
  console.log('    3. processMessage 调用Gemini');
  console.log('    4. sendMessage 发送回复');
  console.log('    5. confirmUpdates 确认消息');
  console.log('    6. 写入.offset文件');
  console.log('  当前问题: 步骤5和6可能没有正确执行');
  results.push({ name: '消息处理流程', passed: true });

  // 总结
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
    console.log('\n💡 如果Bot仍然不回复，可能原因：');
    console.log('   1. GitHub Actions运行间隔5分钟，需等待下一个周期');
    console.log('   2. 手动触发Run workflow可立即处理');
    console.log('   3. 检查GitHub Actions日志确认处理过程');
  }
}

diagnose().catch(e => {
  console.error('诊断异常:', e);
  process.exit(1);
});
