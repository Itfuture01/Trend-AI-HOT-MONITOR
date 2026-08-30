import { fetchJson } from './http.js';

const SOURCE = 'V2EX';
// sov2ex 是 V2EX 的第三方全文搜索（官方 API 在国内直连不可达，sov2ex 可直连）。
// 返回 JSON：hits[]._source = { id, title, replies, created, member, content, ... }
const API = 'https://www.sov2ex.com/api/search';

export const name = SOURCE;

function mapHit(h) {
  const s = h?._source || {};
  const title = (s.title || '').trim();
  if (!title) return null;
  return {
    title,
    url: `https://www.v2ex.com/t/${s.id}`,
    source: SOURCE,
    snippet: (s.content || '').slice(0, 200),
    heat: s.replies ? `${s.replies} 回复` : '',
    member: s.member || '',
    ts: s.created ? Date.parse(s.created) : Date.now(),
  };
}

async function search(q, size = 20) {
  const data = await fetchJson(`${API}?q=${encodeURIComponent(q)}&size=${size}`);
  return (data.hits || []).map(mapHit).filter(Boolean);
}

export async function collectHot() {
  // V2EX 无直达的热门榜接口，用「AI 编程」宽泛查询 + 高回复排序作为代理热点
  return search('AI OR 人工智能 OR 编程 OR LLM', 20);
}

export async function collectSearch(keyword) {
  return search(keyword, 20);
}
