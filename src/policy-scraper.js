const axios = require('axios');
const config = require('./config');

const POLICY_SOURCES = [
  {
    name: '商务部-境外投资',
    url: 'http://www.mofcom.gov.cn/article/zwgk/gkzcfb/',
    type: 'ODI',
    region: '中国'
  },
  {
    name: '国家外汇管理局',
    url: 'https://www.safe.gov.cn/safe/whxwgl/index.html',
    type: '外汇',
    region: '中国'
  },
  {
    name: '国家税务总局-跨境税收',
    url: 'https://www.chinatax.gov.cn/chinatax/n810341/n810755/index.html',
    type: '税务',
    region: '中国'
  },
  {
    name: '香港公司注册处',
    url: 'https://www.cr.gov.hk/sc/home/home.htm',
    type: '公司注册',
    region: '香港'
  },
  {
    name: '新加坡ACRA',
    url: 'https://www.acra.gov.sg/how-to-guides',
    type: '公司注册',
    region: '新加坡'
  },
  {
    name: '迪拜DIEDC',
    url: 'https://www.diedc.gov.ae/en',
    type: '投资',
    region: '迪拜'
  }
];

async function fetchRSSFeed(url) {
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    return response.data;
  } catch (error) {
    console.error(`抓取失败 ${url}:`, error.message);
    return null;
  }
}

async function fetchPolicyUpdates() {
  console.log('🔍 开始扫描政策更新...');
  const updates = [];

  for (const source of POLICY_SOURCES) {
    console.log(`  扫描: ${source.name}`);
    const content = await fetchRSSFeed(source.url);

    if (content) {
      updates.push({
        source: source.name,
        type: source.type,
        region: source.region,
        fetchedAt: new Date().toISOString(),
        status: 'fetched'
      });
    } else {
      updates.push({
        source: source.name,
        type: source.type,
        region: source.region,
        fetchedAt: new Date().toISOString(),
        status: 'fetch_failed'
      });
    }
  }

  return updates;
}

async function fetchFromGoogleAlerts() {
  const keywords = [
    '境外投资 ODI 备案 新政策',
    '跨境资金 外汇管理 通知',
    '企业出海 政策 更新',
    'CRS FATCA 最新',
    '香港公司注册 新规',
    '新加坡公司 注册 变更'
  ];

  console.log('🔍 通过搜索引擎获取政策更新...');
  const results = [];

  for (const keyword of keywords) {
    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const items = parseRSSItems(response.data);
      results.push(...items.map(item => ({
        ...item,
        keyword,
        fetchedAt: new Date().toISOString()
      })));
    } catch (error) {
      console.error(`搜索失败 "${keyword}":`, error.message);
    }
  }

  return results;
}

function parseRSSItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const pubDate = extractTag(itemXml, 'pubDate');
    const description = extractTag(itemXml, 'description');

    if (title && link) {
      items.push({
        title: decodeHTMLEntities(title),
        link,
        pubDate: pubDate || new Date().toISOString(),
        description: description ? decodeHTMLEntities(description).replace(/<[^>]*>/g, '') : ''
      });
    }
  }

  return items;
}

function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function decodeHTMLEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

module.exports = { fetchPolicyUpdates, fetchFromGoogleAlerts, POLICY_SOURCES };
