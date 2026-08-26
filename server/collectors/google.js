import { fetchText, parseRss } from './http.js';

const SOURCE = 'Google';
const EDITIONS = [
  { hl: 'zh-CN', gl: 'CN', ceid: 'CN:zh-Hans' },
  { hl: 'en-US', gl: 'US', ceid: 'US:en' },
];

export const name = SOURCE;

async function searchEdition(kw, { hl, gl, ceid }) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(kw)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
  const xml = await fetchText(url);
  return parseRss(xml, SOURCE);
}

export async function collectHot() {
  const lists = await Promise.all(
    EDITIONS.map((e) =>
      fetchText(`https://news.google.com/rss?hl=${e.hl}&gl=${e.gl}&ceid=${e.ceid}`)
        .then((x) => parseRss(x, SOURCE))
        .catch(() => []),
    ),
  );
  return lists.flat();
}

export async function collectSearch(keyword) {
  const lists = await Promise.all(EDITIONS.map((e) => searchEdition(keyword, e).catch(() => [])));
  return lists.flat();
}
