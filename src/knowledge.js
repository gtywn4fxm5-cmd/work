const { Client } = require('@notionhq/client');
const config = require('./config');

const notion = new Client({ auth: config.notion.apiKey });

async function querySOP(region, businessType) {
  try {
    const filters = [];
    if (region) {
      filters.push({
        property: 'Region',
        select: { equals: region }
      });
    }
    if (businessType) {
      filters.push({
        property: 'Type',
        multi_select: { contains: businessType }
      });
    }

    const response = await notion.databases.query({
      database_id: config.notion.databaseId,
      filter: filters.length > 0 ? { and: filters } : undefined,
      page_size: 5
    });

    return response.results.map(extractPageContent);
  } catch (error) {
    console.error('Notion query error:', error.message);
    return [];
  }
}

async function searchKnowledge(keyword) {
  try {
    const response = await notion.databases.query({
      database_id: config.notion.databaseId,
      filter: {
        property: 'name',
        title: { contains: keyword }
      },
      page_size: 5
    });

    return response.results.map(extractPageContent);
  } catch (error) {
    console.error('Notion search error:', error.message);
    return [];
  }
}

async function saveRecord(title, content, category, region, riskLevel) {
  try {
    const properties = {
      name: {
        title: [{ text: { content: title } }]
      }
    };

    if (category) {
      properties['Type'] = { multi_select: [{ name: category }] };
    }
    if (region) {
      properties['Region'] = { select: { name: region } };
    }
    if (riskLevel) {
      properties['Risk Level'] = { select: { name: riskLevel } };
    }

    properties['Last Verified'] = {
      date: { start: new Date().toISOString().split('T')[0] }
    };

    const blocks = splitContentToBlocks(content);

    const response = await notion.pages.create({
      parent: { database_id: config.notion.databaseId },
      properties,
      children: blocks
    });

    return response.url;
  } catch (error) {
    console.error('Notion save error:', error.message);
    return null;
  }
}

function extractPageContent(page) {
  const title = page.properties.name?.title?.[0]?.plain_text || '无标题';
  const types = page.properties.Type?.multi_select?.map(s => s.name) || [];
  const region = page.properties.Region?.select?.name || '';
  const status = page.properties.Status?.status?.name || '';
  const responseSimple = page.properties['Response-simple']?.rich_text?.[0]?.plain_text || '';
  return { title, types, region, status, responseSimple, pageId: page.id };
}

function splitContentToBlocks(content) {
  const chunks = [];
  const maxLen = 2000;
  for (let i = 0; i < content.length; i += maxLen) {
    chunks.push(content.slice(i, i + maxLen));
  }
  return chunks.map(chunk => ({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: chunk } }]
    }
  }));
}

module.exports = { querySOP, searchKnowledge, saveRecord };
