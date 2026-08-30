import { load } from 'cheerio';
import { fetchText, fetchJson } from './http.js';

const SOURCE = 'GitHub';

export const name = SOURCE;

function mapRepo(r) {
  const fullName = r.full_name || r.name || '';
  if (!fullName) return null;
  const desc = r.description || '';
  const stars = r.stargazers_count || 0;
  return {
    title: fullName,
    url: r.html_url || `https://github.com/${fullName}`,
    source: SOURCE,
    snippet: desc.slice(0, 200),
    heat: stars ? `★ ${stars}` : '',
    lang: r.language || '',
    ts: r.pushed_at ? Date.parse(r.pushed_at) : Date.now(),
  };
}

// 热点：GitHub Trending（每日热门项目，AI 项目新热点第一现场，直连可用）
export async function collectHot() {
  const html = await fetchText('https://github.com/trending?since=daily');
  const $ = load(html);
  const out = [];
  $('article.Box-row').each((_, el) => {
    const $el = $(el);
    const $a = $el.find('h2 a').first();
    const path = ($a.attr('href') || '').replace(/^\//, '').replace(/\/$/, '');
    if (!path) return;
    const desc = $el.find('p').first().text().trim();
    const stars = $el.find('a[href$="/stargazers"]').first().text().replace(/[^\d]/g, '') || '0';
    const lang = $el.find('span[itemprop="programmingLanguage"]').first().text().trim();
    out.push({
      title: path,
      url: `https://github.com/${path}`,
      source: SOURCE,
      snippet: desc.slice(0, 200),
      heat: stars !== '0' ? `★ ${stars}` : '',
      lang,
      ts: Date.now(),
    });
  });
  return out;
}

// 关键词搜索：GitHub 代码库搜索 API（免 key，未认证 10 次/分钟）。
// 用 pushed:>近14天 限定「近期有活跃的新内容」（GitHub 限定词须为日期，如 pushed:>2026-08-16），
// sort=stars 取热度优先。失败（限流/网络）时直接降级为空，不阻塞其他源。
export async function collectSearch(keyword) {
  const pushedAfter = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const q = encodeURIComponent(`${keyword} pushed:>${pushedAfter}`);
  const data = await fetchJson(
    `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=15`,
    { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'TrendMonitor' } },
  );
  return (data.items || []).map(mapRepo).filter(Boolean);
}
