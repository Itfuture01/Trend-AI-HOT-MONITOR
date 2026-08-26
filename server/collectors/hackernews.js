import { fetchJson } from './http.js';

const API = 'https://hn.algolia.com/api/v1';
const SOURCE = 'HackerNews';

export const name = SOURCE;

function mapHit(h) {
  const title = (h.title || h.story_title || '').trim();
  if (!title) return null;
  return {
    title,
    url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    source: SOURCE,
    snippet: (h.story_text || '').slice(0, 200),
    ts: h.created_at_i ? h.created_at_i * 1000 : Date.now(),
  };
}

export async function collectHot() {
  const data = await fetchJson(`${API}/search?tags=front_page&hitsPerPage=30`);
  return (data.hits || []).map(mapHit).filter(Boolean);
}

export async function collectSearch(keyword) {
  const data = await fetchJson(`${API}/search?query=${encodeURIComponent(keyword)}&hitsPerPage=20`);
  return (data.hits || []).map(mapHit).filter(Boolean);
}
