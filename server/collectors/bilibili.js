import { load } from 'cheerio';
import { fetchJson, fetchText } from './http.js';

const SOURCE = 'B站';

export const name = SOURCE;

export async function collectHot() {
  // 移动端公开热搜接口（免 wbi 签名）
  const data = await fetchJson('https://app.bilibili.com/x/v2/search/trending/ranking');
  const list = data?.data?.list ?? data?.data ?? [];
  const arr = Array.isArray(list) ? list : [];
  return arr
    .map((t) => {
      const kw = t.keyword ?? t.show_name ?? t.title ?? '';
      return {
        title: kw,
        url: kw ? `https://search.bilibili.com/all?keyword=${encodeURIComponent(kw)}` : '',
        source: SOURCE,
        snippet: t.show_name ? `热度词：${t.show_name}` : '',
        ts: Date.now(),
      };
    })
    .filter((x) => x.title);
}

export async function collectSearch(keyword) {
  // 关键词搜索：抓取搜索页 HTML（最佳努力，B站前端为客户端渲染，可能取到较少结果）
  const html = await fetchText(
    `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}`,
    { headers: { Referer: 'https://www.bilibili.com' } },
  );
  const $ = load(html);
  const out = [];
  $('.bili-video-card, .video-item').each((_, el) => {
    const $el = $(el);
    const $a = $el.find('a').first();
    const title = ($a.attr('title') || $a.text()).trim();
    if (!title) return;
    let url = $a.attr('href') || '';
    if (url.startsWith('//')) url = 'https:' + url;
    out.push({ title, url, source: SOURCE, snippet: '', ts: Date.now() });
  });
  return out.slice(0, 20);
}
