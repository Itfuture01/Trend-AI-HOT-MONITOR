import { load } from 'cheerio';
import { fetchText } from './http.js';
import { applyFilter } from './filter.js';

const SOURCE = '360';

export const name = SOURCE;

// 解析 "2026年3月11日" / "1天前" / "3小时前" 这类中文日期 → 时间戳（解析失败返回 null）
function parseCnDate(str) {
  const s = String(str || '').trim();
  if (!s) return null;
  let m = s.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  m = s.match(/(\d+)天前/);
  if (m) return Date.now() - Number(m[1]) * 86400000;
  m = s.match(/(\d+)小时前/);
  if (m) return Date.now() - Number(m[1]) * 3600000;
  return null;
}

function parseHtml(html) {
  const $ = load(html);
  const out = [];
  const seen = new Set();
  $('.res-list').each((_, el) => {
    const $el = $(el);
    const $a = $el.find('.res-title a').first();
    const title = $a.text().trim();
    if (!title) return;
    if (seen.has(title)) return;
    seen.add(title);
    // 360 结果锚点上带真实目标 URL（data-mdurl），比跳转壳更可靠
    const realUrl = $a.attr('data-mdurl') || '';
    const href = $a.attr('href') || '';
    const site = $el.find('.g-linkinfo-a').first().text().trim() || '';
    const desc = $el.find('.res-desc').first().text().trim();
    const dateText = $el.find('.res-desc span.gray').first().text().trim();
    out.push({
      title,
      url: realUrl || href,
      source: SOURCE,
      snippet: desc.slice(0, 200),
      site,
      ts: parseCnDate(dateText) || Date.now(),
    });
  });
  return applyFilter(out);
}

export async function collectHot() {
  // 360 无热搜榜，用通用 AI 话题作为代理热点
  return collectSearch('AI 人工智能 大模型 最新');
}

export async function collectSearch(keyword) {
  const html = await fetchText(`https://www.so.com/s?q=${encodeURIComponent(keyword)}`);
  return parseHtml(html);
}
