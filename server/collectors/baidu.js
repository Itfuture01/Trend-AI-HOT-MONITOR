import { load } from 'cheerio';
import { fetchText, fetchJson } from './http.js';
import { applyFilter } from './filter.js';

const SOURCE = '百度';
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';

export const name = SOURCE;

// 热搜榜（top.baidu.com 公开 JSON，wise 版免登录）。
// 返回结构：cards[].content 可能是 [{content:[真实条目]}] 或直接是条目数组，这里做扁平化容错。
export async function collectHot() {
  const data = await fetchJson('https://top.baidu.com/api/board?platform=wise&tab=realtime', {
    headers: { Referer: 'https://top.baidu.com/' },
  });
  const out = [];
  for (const card of data?.data?.cards ?? []) {
    const content = card?.content;
    if (!Array.isArray(content)) continue;
    for (const x of content) {
      if (Array.isArray(x?.content)) {
        for (const t of x.content) pushWord(out, t);
      } else if (x?.word) {
        pushWord(out, x);
      }
    }
  }
  return out;
}

function pushWord(out, t) {
  const kw = (t.word || '').trim();
  if (!kw) return;
  out.push({
    title: kw,
    url: t.url || `https://www.baidu.com/s?wd=${encodeURIComponent(kw)}`,
    source: SOURCE,
    snippet: '',
    heat: typeof t.index === 'number' ? `热搜 #${t.index}` : '',
    ts: Date.now(),
  });
}

// 关键词搜索：解析移动端结果页（百度会随机触发安全验证，检测到即放弃本轮）
export async function collectSearch(keyword) {
  const html = await fetchText(`https://www.baidu.com/s?wd=${encodeURIComponent(keyword)}`, {
    headers: { 'User-Agent': MOBILE_UA },
  });
  // 安全验证 / 反爬页检测
  if (/安全验证|wappass|百度安全|验证码|请开启javascript并刷新/.test(html)) return [];
  const $ = load(html);
  const out = [];
  const seen = new Set();
  $('h3').each((_, el) => {
    const $h = $(el);
    const $a = $h.find('a').first();
    const title = $a.attr('title') || $a.text().trim();
    if (!title) return;
    if (seen.has(title)) return;
    seen.add(title);
    const href = $a.attr('href') || '';
    const url = href.startsWith('http') ? href : `https://m.baidu.com${href}`;
    out.push({ title, url, source: SOURCE, snippet: '', ts: Date.now() });
  });
  return applyFilter(out);
}
