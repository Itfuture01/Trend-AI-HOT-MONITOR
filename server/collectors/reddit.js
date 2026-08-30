import { fetchJson } from './http.js';

const SOURCE = 'Reddit';
// 在国内直连通常不可达（被墙），直连失败会被上层 allSettled 跳过，不影响其他源。
// 配置代理后自动恢复。
const UA = 'TrendMonitor/1.0 (AI trend monitor; contact: admin@example.com)';
// 面向 AI 编程博主的子版块组合
const SUBS = 'LocalLLaMA+MachineLearning+OpenAI+ollama+artificial';
const HOT_URL = `https://www.reddit.com/r/${SUBS}/hot.json?limit=25`;

export const name = SOURCE;

function mapPost(p) {
  const d = p?.data || {};
  const title = (d.title || '').trim();
  if (!title) return null;
  // 去除 markdown 噪点的正文摘要
  const selftext = (d.selftext || '').replace(/[#>*`|\[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    title,
    url: d.url || `https://www.reddit.com${d.permalink || ''}`,
    source: SOURCE,
    snippet: selftext.slice(0, 200),
    heat: d.score ? `↑ ${d.score} · ${d.num_comments || 0} 评论` : '',
    subreddit: d.subreddit || '',
    ts: d.created_utc ? d.created_utc * 1000 : Date.now(),
  };
}

export async function collectHot() {
  const data = await fetchJson(HOT_URL, { headers: { 'User-Agent': UA } });
  return (data?.data?.children || []).map(mapPost).filter(Boolean);
}

export async function collectSearch(keyword) {
  const data = await fetchJson(
    `https://www.reddit.com/search.json?q=${encodeURIComponent(keyword)}&sort=top&t=day&limit=20`,
    { headers: { 'User-Agent': UA } },
  );
  return (data?.data?.children || []).map(mapPost).filter(Boolean);
}
