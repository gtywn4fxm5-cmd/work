# AI工作助手

基于 GitHub Actions + Gemini 2.5 Flash + Telegram + Notion 的全免费AI辅助工作系统。

## 功能特性

- ✅ 跨境金融知识查询
- ✅ 海外架构方案设计
- ✅ 法规政策解读
- ✅ 文档摘要生成
- ✅ 自动保存到Notion
- ✅ 手机/平板随时随地访问

## 部署步骤

### 1. 获取API密钥

#### Gemini API
- 访问 https://makersuite.google.com/
- 创建API密钥

#### Telegram Bot
- 在Telegram中搜索 @BotFather
- 发送 `/newbot` 创建新机器人
- 获取 Bot Token

#### Notion API
- 访问 https://www.notion.so/my-integrations
- 创建新集成，获取API密钥
- 在Notion中创建数据库，分享给集成
- 获取数据库ID

### 2. 设置GitHub Secrets

在你的GitHub仓库中设置以下Secrets：
- `GEMINI_API_KEY` - Google Gemini API密钥
- `NOTION_API_KEY` - Notion API密钥
- `NOTION_DATABASE_ID` - Notion数据库ID
- `TELEGRAM_BOT_TOKEN` - Telegram Bot Token

### 3. 运行方式

#### 本地测试
```bash
npm install
cp .env.example .env
# 编辑 .env 文件，填入你的密钥
npm test
```

#### GitHub Actions
- 启用Actions后，每5分钟自动运行
- 也可手动触发 Workflow

## 使用方法

1. 在Telegram中搜索你的Bot
2. 发送 `/start` 开始使用
3. 直接发送问题，AI会自动回答并保存到Notion

## 技术栈

- Node.js
- Google Gemini 2.5 Flash
- Notion API
- Telegram Bot API
- GitHub Actions

## 注意事项

- 本系统完全免费使用
- 注意保护API密钥安全
- 建议定期备份Notion数据
