import { fetchText, parseRss } from './http.js';

const SOURCE = 'Bing';

export const name = SOURCE;

export async function collectHot() {
  const xml = await fetchText('https://www.bing.com/news?format=rss');
  const items = parseRss(xml, SOURCE);
  return items.length ? items : collectSearch('人工智能 AI');
}

export async function collectSearch(keyword) {
  const url = `https://www.bing.com/news/search?q=${encodeURIComponent(keyword)}&format=rss`;
  const xml = await fetchText(url);
  return parseRss(xml, SOURCE);
}
