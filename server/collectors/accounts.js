// 账号解析：当监控关键词本身是「博主 / 官方 / 账号」时，直接拉取该账号的资料，
// 并尽量附上其最新动态。目前支持：
//   - GitHub（组织/用户）：资料 + 最近活跃仓库（免 key，未认证 60 次/时）
//   - B站（UP主）：资料（名称/头像/粉丝/签名），最新视频需 WBI 签名，暂不提供
// 精确匹配才算命中（如搜 "DeepSeek" 不会误命中某个重名用户），
// 结果带 60 分钟内存缓存，避免每轮调度重复打免 Key 接口的配额。
import { fetchJson } from './http.js';

const TTL = 60 * 60 * 1000; // 60 分钟
const cache = new Map(); // `platform|keyword` -> { t, data }，data 可为 null（负缓存：确认非账号）
const GH_NAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/; // GitHub 用户名规则：单 token 英文

function cached(key) {
  const rec = cache.get(key);
  if (!rec) return undefined;
  if (Date.now() - rec.t > TTL) {
    cache.delete(key);
    return undefined;
  }
  return rec.data;
}
function remember(key, data) {
  cache.set(key, { t: Date.now(), data });
}

const GH_HEADERS = { Accept: 'application/vnd.github+json', 'User-Agent': 'TrendMonitor' };

// GitHub：登录名（组织/用户）精确命中。404/限流/网络错 → 视为非账号，缓存空结果。
async function githubAccount(kw) {
  if (!GH_NAME_RE.test(kw)) return null;
  const key = `GitHub|${kw.toLowerCase()}`;
  const hit = cached(key);
  if (hit !== undefined) return hit;
  try {
    const u = await fetchJson(`https://api.github.com/users/${encodeURIComponent(kw)}`, {
      headers: GH_HEADERS,
      trackFail: false, // 404 是「无此用户」的常态，不计入熔断
      retries: 1, // 网络抖动/限流偶发，重试一次更稳
    });
    // 质量门槛：GitHub 产品名/普通词容易撞上低活账号（如搜 "DeepSeek" 撞到 122 粉同名组织）。
    // 粉丝 <300 视为非「博主/官方」——真正的官方组织（deepseek-ai 10万+）或知名开发者都远超此数。
    if ((u.followers || 0) < 300) {
      remember(key, null);
      return null;
    }
    const profile = {
      name: u.name || u.login,
      handle: u.login,
      avatar: u.avatar_url || '',
      bio: u.bio || '',
      followers: u.followers || 0,
      url: u.html_url || `https://github.com/${u.login}`,
      type: u.type === 'Organization' ? 'Organization' : 'User',
    };
    let posts = [];
    try {
      const repos = await fetchJson(
        `https://api.github.com/users/${encodeURIComponent(kw)}/repos?sort=pushed&per_page=8`,
        { headers: GH_HEADERS, trackFail: false, retries: 1 },
      );
      posts = (repos || [])
        .filter((r) => !r.fork)
        .map((r) => ({
          title: r.full_name || r.name,
          url: r.html_url || `https://github.com/${r.full_name}`,
          source: 'GitHub',
          snippet: (r.description || '').slice(0, 200),
          heat: r.stargazers_count ? `★ ${r.stargazers_count}` : '',
          ts: r.pushed_at ? Date.parse(r.pushed_at) : Date.now(),
        }));
    } catch {
      // 仓库列表失败不影响资料卡
    }
    const result = { platform: 'GitHub', profile, posts };
    remember(key, result);
    return result;
  } catch (e) {
    // 仅 HTTP 404 = 确认无此账号，可缓存负结果；网络/5xx/限流为临时，不缓存、下轮重试
    if (String(e.message).includes('HTTP 404')) remember(key, null);
    return null;
  }
}

// B站：UP主名精确命中（大小写不敏感）。
async function bilibiliAccount(kw) {
  const key = `B站|${kw.toLowerCase()}`;
  const hit = cached(key);
  if (hit !== undefined) return hit;
  try {
    const data = await fetchJson(
      `https://api.bilibili.com/x/web-interface/search/type?search_type=bili_user&keyword=${encodeURIComponent(kw)}&page=1`,
      // B站 对短时间重复请求偶发 412 临时风控，重试一次（trackFail=false 不误伤熔断）
      { headers: { Referer: 'https://search.bilibili.com/' }, trackFail: false, retries: 1 },
    );
    const users = data?.data?.result || [];
    const found = users.find((u) => String(u.uname || '').trim().toLowerCase() === kw.toLowerCase());
    if (!found) {
      remember(key, null);
      return null;
    }
    const result = {
      platform: 'B站',
      profile: {
        name: found.uname,
        handle: String(found.mid || ''),
        avatar: found.upic ? (found.upic.startsWith('//') ? `https:${found.upic}` : found.upic) : '',
        bio: found.usign || '',
        followers: found.fans || 0,
        url: `https://space.bilibili.com/${found.mid}`,
        type: 'UP主',
      },
      posts: [], // 最新视频需 WBI 签名，暂不提供
    };
    remember(key, result);
    return result;
  } catch {
    remember(key, null);
    return null;
  }
}

// 返回命中账号数组：[{ platform, profile: {name,handle,avatar,bio,followers,url,type}, posts: [item] }]
export async function resolveAccount(keyword) {
  const kw = (keyword || '').trim();
  if (!kw) return [];
  const [gh, bl] = await Promise.all([githubAccount(kw), bilibiliAccount(kw)]);
  return [gh, bl].filter(Boolean);
}

// 测试/调试用：清空缓存
export function clearAccountCache() {
  cache.clear();
}
