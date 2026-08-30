import { load } from 'cheerio';
import { fetchJson, fetchText } from './http.js';
import { applyFilter } from './filter.js';

const SOURCE = 'B站';

export const name = SOURCE;

// 提取「1.2万」/「3456」形式的播放量 → 数字（解析失败返回 null）
function parsePlay(str) {
  const s = String(str || '').trim();
  if (!s || s === '--') return null;
  let m = s.match(/([\d.]+)\s*(万|亿)?/);
  if (!m) return null;
  let n = Number(m[1]);
  if (m[2] === '万') n *= 10000;
  if (m[2] === '亿') n *= 100000000;
  return Math.round(n);
}

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
    const $a = $el.find('.bili-video-card__info--tit a, a').first();
    const title = ($a.attr('title') || $a.text()).trim();
    if (!title) return;
    let url = $a.attr('href') || '';
    if (url.startsWith('//')) url = 'https:' + url;
    // 播放量（.bili-video-card__stats--item 形如「1.2万播放」）
    const playText = $el.find('.bili-video-card__stats--item').first().text().trim();
    const play = parsePlay(playText.replace(/播放.*$/, ''));
    out.push({
      title,
      url,
      source: SOURCE,
      snippet: '',
      heat: play ? `${play.toLocaleString()} 播放` : '',
      ts: Date.now(),
    });
  });
  return applyFilter(out).slice(0, 20);
}
