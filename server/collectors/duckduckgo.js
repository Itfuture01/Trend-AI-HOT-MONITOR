import { load } from 'cheerio';
import { fetchText } from './http.js';

const SOURCE = 'DuckDuckGo';

export const name = SOURCE;

// DDG 结果链接是跳转链接，解出真实 URL
function cleanUrl(u) {
  if (!u) return '';
  try {
    const parsed = new URL(u, 'https://html.duckduckgo.com');
    const uddg = parsed.searchParams.get('uddg');
    if (uddg) return decodeURIComponent(uddg);
  } catch {
    /* ignore */
  }
  return u;
}

function parseHtml(html) {
  const $ = load(html);
  const out = [];
  $('.result').each((_, el) => {
    const $el = $(el);
    const $a = $el.find('a.result__a').first();
    const title = $a.text().trim();
    if (!title) return;
    out.push({
      title,
      url: cleanUrl($a.attr('href')),
      source: SOURCE,
      snippet: $el.find('.result__snippet').first().text().trim().slice(0, 200),
      ts: Date.now(),
    });
  });
  return out;
}

async function searchHtml(kw) {
  const html = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(kw)}`);
  return parseHtml(html);
}

export async function collectHot() {
  // 搜索引擎无榜单，用通用 AI 话题作为代理热点
  return searchHtml('AI 人工智能 最新进展');
}

export async function collectSearch(keyword) {
  return searchHtml(keyword);
}
