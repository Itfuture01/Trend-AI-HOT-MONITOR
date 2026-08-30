import cron from 'node-cron';
import { config } from './config.js';
import { db, dedupeItem, touchHotspot } from './db.js';
import { searchAll, hotAll, searchWithAccounts } from './collectors/index.js';
import { analyzeItems, aiEnabled } from './ai.js';
import { notifyAlert, ensureVapidKeys } from './notify.js';
import { broadcast } from './events.js';
import { cleanTitle } from './collectors/filter.js';

const running = { keyword: false, hotspot: false };
const lastRun = { keyword: null, hotspot: null, manual: null };

const HOTSPOT_THRESHOLD = 40; // 热点聚合更宽松（相关性 0~100）
const NATIVE_HOT_TOPIC = 'AI、人工智能、大模型、科技、编程'; // 原生热搜榜的过滤主题

export function getStatus() {
  return { running, lastRun };
}

// ---------- 关键词监控 ----------
export async function runKeywordMonitor() {
  if (running.keyword) return { skipped: true, reason: '关键词监控正在运行中' };
  running.keyword = true;
  try {
    const keywords = db.prepare('SELECT * FROM keywords WHERE enabled = 1').all();
    const results = [];
    for (const kw of keywords) {
      results.push({ keyword: kw.keyword, ...(await processKeyword(kw)) });
    }
    lastRun.keyword = Date.now();
    const summary = { type: 'keyword', keywords: results, at: Date.now() };
    broadcast('scan-done', summary);
    return summary;
  } finally {
    running.keyword = false;
  }
}

async function processKeyword(kw) {
  // 搜索 + 账号解析：账号（GitHub/B站）的最新动态并入 items 参与告警，资料卡不告警
  const { items, errors } = await searchWithAccounts(kw.keyword);
  const fresh = items.filter((it) => dedupeItem(it));

  // 告警节流：同关键词 + 同内容（规范化标题）24h 内只告警一次，
  // 防止搜狗/360 等源 URL 变化导致的重复轰炸。
  const recentAlerts = new Set(
    db
      .prepare(
        "SELECT title FROM alerts WHERE keyword = ? AND created_at > datetime('now','localtime','-24 hours')",
      )
      .all(kw.keyword)
      .map((r) => cleanTitle(r.title)[0])
      .filter(Boolean),
  );
  const throttled = fresh.filter((it) => {
    const k = cleanTitle(it.title)[0];
    return k && !recentAlerts.has(k);
  });

  const verdicts = await analyzeItems(throttled, { topic: kw.keyword });
  let alerted = 0;
  for (let i = 0; i < throttled.length; i++) {
    const it = throttled[i];
    const v = verdicts[i] || {};
    if (v.relevant >= config.aiThreshold && v.genuine) {
      await notifyAlert({
        keyword_id: kw.id,
        keyword: kw.keyword,
        title: it.title,
        url: it.url,
        source: it.source,
        reason: v.reason,
        ai_verdict: `[${v.level || '—'}] ${Math.round(v.relevant)}% · ${v.summary}`,
      });
      alerted++;
    }
  }
  return { collected: items.length, fresh: fresh.length, throttled: throttled.length, alerted, errors };
}

// ---------- 热点聚合 ----------
export async function runHotspotAggregation() {
  if (running.hotspot) return { skipped: true, reason: '热点聚合正在运行中' };
  running.hotspot = true;
  try {
    cleanupOldHotspots();

    // 1) 原生热搜榜（微博/B站/HN/Twitter 等），用 AI 主题过滤
    const hot = await hotAll();
    const nativeStored = await storeHotspots(hot.items, 'trending', NATIVE_HOT_TOPIC);

    // 2) 各监控关键词的搜索（热点范围 = 监控关键词，动态跟随关键词增删）
    const keywords = db.prepare('SELECT * FROM keywords WHERE enabled = 1').all();
    const byKeyword = {};
    for (const kw of keywords) {
      const { items, accounts, errors } = await searchWithAccounts(kw.keyword);
      byKeyword[kw.keyword] = {
        collected: items.length,
        stored: await storeHotspots(items, kw.keyword, kw.keyword),
        accountStored: storeAccountProfiles(accounts, kw.keyword),
        errors,
      };
    }

    lastRun.hotspot = Date.now();
    const summary = { type: 'hotspot', nativeStored, byKeyword, at: Date.now() };
    broadcast('scan-done', summary);
    return summary;
  } finally {
    running.hotspot = false;
  }
}

async function storeHotspots(items, range, topic) {
  const fresh = items.filter((it) => dedupeItem(it));
  const verdicts = await analyzeItems(fresh, { topic });
  let stored = 0;
  for (let i = 0; i < fresh.length; i++) {
    const it = fresh[i];
    const v = verdicts[i] || {};
    if (v.relevant >= HOTSPOT_THRESHOLD && v.genuine) {
      // 热点级去重：同标题+来源+范围已存在则仅刷新 last_seen，避免搜狗等变 URL 造成重复
      if (touchHotspot(it.title, it.source, range) != null) continue;
      db.prepare(
        'INSERT INTO hotspots (title, summary, source, url, score, range, level, model, genuine) VALUES (?,?,?,?,?,?,?,?,?)',
      ).run(it.title, v.summary, it.source, it.url, v.relevant, range, v.level, aiEnabled() ? config.openrouter.model : '', v.genuine ? 1 : 0);
      stored++;
    }
  }
  return stored;
}

// 账号资料 → 热点卡片（复用热点表，无前端改动）：
// 标题=账号名（GitHub 组织如 DeepSeek（deepseek-ai）；B站 UP主 直接用昵称），
// 摘要=简介 · 类型 · 粉丝数，链接=账号主页。命中同一账号卡只刷新 last_seen。
function storeAccountProfiles(accounts, range) {
  if (!accounts?.length) return 0;
  let n = 0;
  for (const a of accounts) {
    const p = a.profile || {};
    if (!p.name) continue;
    const handleOk = p.handle && String(p.handle) !== p.name && !/^\d+$/.test(String(p.handle));
    const title = handleOk ? `${p.name}（${p.handle}）` : p.name;
    if (touchHotspot(title, a.platform, range) != null) continue;
    const typeLabel = p.type === 'Organization' ? '官方组织' : p.type === 'User' ? '用户' : (p.type || '');
    const summary = [
      p.bio,
      typeLabel,
      p.followers ? `${Number(p.followers).toLocaleString('zh-CN')} 粉丝` : '',
    ].filter(Boolean).join(' · ');
    db.prepare(
      'INSERT INTO hotspots (title, summary, source, url, score, range, level, model, genuine) VALUES (?,?,?,?,?,?,?,?,?)',
    ).run(title, summary, a.platform, p.url || '', 85, range, 'high', aiEnabled() ? config.openrouter.model : '', 1);
    n++;
  }
  return n;
}

function cleanupOldHotspots() {
  db.prepare("DELETE FROM hotspots WHERE first_seen < datetime('now', 'localtime', '-7 days')").run();
}

// 手动触发一次全量扫描（关键词 + 热点）
export async function manualScan() {
  if (running.keyword || running.hotspot) return { skipped: true, reason: '已有扫描在进行中' };
  lastRun.manual = Date.now();
  const keywordRes = await runKeywordMonitor();
  const hotspotRes = await runHotspotAggregation();
  return { keyword: keywordRes, hotspot: hotspotRes, at: Date.now() };
}

// ---------- 定时任务 ----------
export function startScheduler() {
  ensureVapidKeys();

  cron.schedule(`*/${config.monitorIntervalMin} * * * *`, () => {
    runKeywordMonitor()
      .then((r) => console.log('[scheduler] 关键词监控完成', summarize(r)))
      .catch((e) => console.error('[scheduler] 关键词监控失败', e.message));
  });

  cron.schedule(`*/${config.hotspotIntervalMin} * * * *`, () => {
    runHotspotAggregation()
      .then((r) => console.log('[scheduler] 热点聚合完成', summarize(r)))
      .catch((e) => console.error('[scheduler] 热点聚合失败', e.message));
  });

  console.log(
    `[scheduler] 关键词监控每 ${config.monitorIntervalMin} 分钟，热点聚合每 ${config.hotspotIntervalMin} 分钟`,
  );
}

function summarize(r) {
  if (!r) return '';
  if (r.keywords) {
    const total = r.keywords.reduce((a, k) => a + (k.alerted || 0), 0);
    return `${r.keywords.length} 个关键词，告警 ${total} 条`;
  }
  if (r.byKeyword) {
    return `原生 ${r.nativeStored} 条 + 关键词 ${Object.keys(r.byKeyword).length} 个`;
  }
  return '';
}
