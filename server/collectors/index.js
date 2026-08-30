import * as twitter from './twitter.js';
import * as google from './google.js';
import * as bing from './bing.js';
import * as duckduckgo from './duckduckgo.js';
import * as hackernews from './hackernews.js';
import * as sogou from './sogou.js';
import * as bilibili from './bilibili.js';
import * as weibo from './weibo.js';
import * as github from './github.js';
import * as v2ex from './v2ex.js';
import * as so360 from './so360.js';
import * as baidu from './baidu.js';
import * as reddit from './reddit.js';
import * as weixin from './weixin.js';
import { resolveAccount } from './accounts.js';
import { db } from '../db.js';

const SOURCES = [
  twitter, google, bing, duckduckgo, hackernews,
  sogou, bilibili, weibo, github, v2ex, so360, baidu, reddit, weixin,
];

export { SOURCES };

// 返回当前启用的数据源（未在 sources 表中出现的视为默认启用）
export function enabledSources() {
  const disabled = new Set(
    db.prepare('SELECT name FROM sources WHERE enabled = 0').all().map((r) => r.name),
  );
  return SOURCES.filter((s) => !disabled.has(s.name));
}

function settle(results, sources) {
  const items = [];
  const errors = [];
  results.forEach((r, i) => {
    const src = sources[i].name;
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      for (const it of r.value) {
        if (it && it.title) items.push({ ...it, source: it.source || src });
      }
    } else {
      errors.push(`${src}: ${r.reason?.message || r.reason || 'unknown'}`);
    }
  });
  return { items, errors };
}

// 在所有源上搜索某关键词（单源失败不影响整体）
export async function searchAll(keyword) {
  const srcs = enabledSources();
  const results = await Promise.allSettled(srcs.map((s) => s.collectSearch(keyword)));
  return settle(results, srcs);
}

// 搜索 + 账号解析：若关键词本身是「博主/官方/账号」（GitHub 组织/用户、B站 UP主），
// 并入其最新动态（posts），同时返回账号资料（profile），由上层决定如何展示。
export async function searchWithAccounts(keyword) {
  const [search, accounts] = await Promise.all([searchAll(keyword), resolveAccount(keyword)]);
  const posts = accounts.flatMap((a) =>
    (a.posts || []).map((p) => ({ ...p, source: p.source || a.platform })),
  );
  return { items: [...search.items, ...posts], accounts, errors: search.errors };
}

// 拉取所有源的原生热点榜单
export async function hotAll() {
  const srcs = enabledSources();
  const results = await Promise.allSettled(srcs.map((s) => s.collectHot()));
  return settle(results, srcs);
}
