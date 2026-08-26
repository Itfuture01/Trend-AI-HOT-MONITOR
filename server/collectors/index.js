import * as twitter from './twitter.js';
import * as google from './google.js';
import * as bing from './bing.js';
import * as duckduckgo from './duckduckgo.js';
import * as hackernews from './hackernews.js';
import * as sogou from './sogou.js';
import * as bilibili from './bilibili.js';
import * as weibo from './weibo.js';
import { db } from '../db.js';

const SOURCES = [twitter, google, bing, duckduckgo, hackernews, sogou, bilibili, weibo];

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

// 拉取所有源的原生热点榜单
export async function hotAll() {
  const srcs = enabledSources();
  const results = await Promise.allSettled(srcs.map((s) => s.collectHot()));
  return settle(results, srcs);
}
