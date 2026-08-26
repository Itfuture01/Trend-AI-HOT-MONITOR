import { load } from 'cheerio';
import { fetchJson, fetchText } from './http.js';

const SOURCE = '微博';

export const name = SOURCE;

function absUrl(u) {
  if (!u) return '';
  if (u.startsWith('//')) return 'https:' + u;
  return u;
}

export async function collectHot() {
  try {
    // 优先 JSON 接口
    const data = await fetchJson('https://weibo.com/ajax/side/hotSearch', {
      headers: { Referer: 'https://weibo.com' },
    });
    const realtime = data?.data?.realtime ?? [];
    const arr = Array.isArray(realtime) ? realtime : [];
    return arr
      .map((t) => {
        const kw = t.word ?? t.note ?? '';
        return {
          title: kw,
          url: t.url ? absUrl(t.url) : `https://s.weibo.com/weibo?q=${encodeURIComponent(kw)}`,
          source: SOURCE,
          snippet: t.num ? `热度 ${t.num}` : '',
          ts: Date.now(),
        };
      })
      .filter((x) => x.title);
  } catch {
    // 兜底：解析网页版热搜
    const html = await fetchText('https://s.weibo.com/top/summary?cate=realtimehot', {
      headers: { Referer: 'https://s.weibo.com' },
    });
    const $ = load(html);
    const out = [];
    $('td.td-02 a').each((_, el) => {
      const title = $(el).text().trim();
      const href = $(el).attr('href') || '';
      if (title) out.push({ title, url: absUrl(href), source: SOURCE, snippet: '', ts: Date.now() });
    });
    return out;
  }
}

export async function collectSearch(keyword) {
  const html = await fetchText(`https://s.weibo.com/weibo?q=${encodeURIComponent(keyword)}`, {
    headers: { Referer: 'https://s.weibo.com' },
  });
  const $ = load(html);
  const out = [];
  $('.card-wrap').each((_, el) => {
    const $el = $(el);
    const text = $el.find('.txt').text().trim();
    if (!text) return;
    out.push({
      title: text.slice(0, 120),
      url: absUrl($el.find('a').first().attr('href')),
      source: SOURCE,
      snippet: text.slice(0, 200),
      ts: Date.now(),
    });
  });
  return out.slice(0, 20);
}
