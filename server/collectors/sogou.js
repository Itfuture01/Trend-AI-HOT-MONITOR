import { load } from 'cheerio';
import { fetchText } from './http.js';

const SOURCE = '搜狗';
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';

export const name = SOURCE;

// 解析搜狗移动端结果页（桌面端有反爬验证页，移动端可直接取到结果）
function parseMobile(html) {
  const $ = load(html);
  const out = [];
  const seen = new Set();
  $('a.resultLink').each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href') || '';
    let title = $a.text().trim();
    let url = '';
    try {
      const u = new URL(href, 'https://m.sogou.com');
      url = u.href;
      const tp = u.searchParams.get('title');
      if (tp) title = decodeURIComponent(tp);
    } catch {
      /* ignore */
    }
    if (!title) return;
    const key = title;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ title, url, source: SOURCE, snippet: '', ts: Date.now() });
  });
  return out;
}

export async function collectHot() {
  // 搜索引擎无榜单，用通用 AI 话题作为代理热点
  return collectSearch('AI 人工智能 最新');
}

export async function collectSearch(keyword) {
  const html = await fetchText(
    `https://m.sogou.com/web/searchList.jsp?keyword=${encodeURIComponent(keyword)}`,
    { headers: { 'User-Agent': MOBILE_UA } },
  );
  return parseMobile(html);
}
