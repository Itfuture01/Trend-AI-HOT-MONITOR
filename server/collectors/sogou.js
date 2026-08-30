import { load } from 'cheerio';
import { fetchText } from './http.js';
import { applyFilter } from './filter.js';

const SOURCE = '搜狗';
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';

export const name = SOURCE;

// tsn=1 为近 24 小时时间过滤：只保留「新发布」内容，剔除百科/下载站/介绍页等老页面。
// 实测综合排序会被下载站、搜狗百科、介绍页灌满，加 tsn=1 后结果变为正规新闻。
const TSN = 1; // 1=一天内

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
    // 同一轮内的标题级去重
    const key = title;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ title, url, source: SOURCE, snippet: '', ts: Date.now() });
  });
  // 统一噪音过滤（下载站/百科/介绍页）+ 站点名提取
  return applyFilter(out);
}

export async function collectHot() {
  // 搜索引擎无榜单，用通用 AI 话题作为代理热点
  return collectSearch('AI 人工智能 最新');
}

export async function collectSearch(keyword) {
  const html = await fetchText(
    `https://m.sogou.com/web/searchList.jsp?keyword=${encodeURIComponent(keyword)}&tsn=${TSN}`,
    { headers: { 'User-Agent': MOBILE_UA } },
  );
  return parseMobile(html);
}
