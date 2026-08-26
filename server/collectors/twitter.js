import { config } from '../config.js';
import { fetchJson } from './http.js';

const SOURCE = 'Twitter';

export const name = SOURCE;

function headers() {
  return { 'X-API-Key': config.twitter.apiKey };
}

function pickArray(data) {
  // twitterapi.io 不同端点返回结构不一致，做宽松解析
  const arr = data?.tweets ?? data?.data ?? data?.trends ?? data;
  return Array.isArray(arr) ? arr : [];
}

export async function collectHot() {
  if (!config.twitter.apiKey) return [];
  const data = await fetchJson(`${config.twitter.baseUrl}/twitter/trends`, { headers: headers() });
  return pickArray(data)
    .map((t) => {
      const kw = t.name ?? t.trend_name ?? t.query ?? '';
      return {
        title: kw ? `#${kw}` : '',
        url: kw ? `https://x.com/search?q=${encodeURIComponent(kw)}` : '',
        source: SOURCE,
        snippet: t.tweet_volume ? `推文量 ${t.tweet_volume}` : '',
        ts: Date.now(),
      };
    })
    .filter((x) => x.title);
}

export async function collectSearch(keyword) {
  if (!config.twitter.apiKey) return [];
  const url = `${config.twitter.baseUrl}/twitter/tweet/advanced_search?query=${encodeURIComponent(
    keyword,
  )}&queryType=Latest`;
  const data = await fetchJson(url, { headers: headers() });
  return pickArray(data)
    .map((t) => {
      const text = (t.text ?? t.full_text ?? '').trim();
      return {
        title: text.slice(0, 120),
        url: t.url ?? (t.id ? `https://x.com/i/web/status/${t.id}` : ''),
        source: SOURCE,
        snippet: text.slice(0, 200),
        ts: t.created_at ? Date.parse(t.created_at) : Date.now(),
      };
    })
    .filter((x) => x.title);
}
