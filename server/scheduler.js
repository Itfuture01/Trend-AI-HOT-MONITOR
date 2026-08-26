import cron from 'node-cron';
import { config } from './config.js';
import { db, dedupeItem, hashItem } from './db.js';
import { searchAll, hotAll } from './collectors/index.js';
import { analyzeItems } from './ai.js';
import { notifyAlert, ensureVapidKeys } from './notify.js';
import { broadcast } from './events.js';

const running = { keyword: false, hotspot: false };
const lastRun = { keyword: null, hotspot: null, manual: null };

const HOTSPOT_THRESHOLD = 0.4; // 热点聚合更宽松
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
  const { items, errors } = await searchAll(kw.keyword);
  const fresh = items.filter((it) => dedupeItem(it));
  const verdicts = await analyzeItems(fresh, { topic: kw.keyword });
  let alerted = 0;
  for (let i = 0; i < fresh.length; i++) {
    const it = fresh[i];
    const v = verdicts[i] || {};
    if (v.relevant >= config.aiThreshold && v.genuine) {
      await notifyAlert({
        keyword_id: kw.id,
        keyword: kw.keyword,
        title: it.title,
        url: it.url,
        source: it.source,
        reason: v.reason,
        ai_verdict: `${v.relevant.toFixed(2)} · ${v.summary}`,
      });
      alerted++;
    }
  }
  return { collected: items.length, fresh: fresh.length, alerted, errors };
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

    // 2) 各范围的关键词搜索
    const ranges = collectRanges();
    const byRange = {};
    for (const r of ranges) {
      const { items, errors } = await searchAll(r);
      byRange[r] = { collected: items.length, stored: await storeHotspots(items, r, r), errors };
    }

    lastRun.hotspot = Date.now();
    const summary = { type: 'hotspot', nativeStored, byRange, at: Date.now() };
    broadcast('scan-done', summary);
    return summary;
  } finally {
    running.hotspot = false;
  }
}

function collectRanges() {
  const set = new Set([config.defaultRange]);
  const scopes = db.prepare('SELECT DISTINCT scope FROM keywords WHERE scope != \'\'').all();
  for (const s of scopes) if (s.scope) set.add(s.scope);
  return [...set];
}

async function storeHotspots(items, range, topic) {
  const fresh = items.filter((it) => dedupeItem(it));
  const verdicts = await analyzeItems(fresh, { topic });
  let stored = 0;
  for (let i = 0; i < fresh.length; i++) {
    const it = fresh[i];
    const v = verdicts[i] || {};
    if (v.relevant >= HOTSPOT_THRESHOLD && v.genuine) {
      db.prepare(
        'INSERT INTO hotspots (title, summary, source, url, score, range) VALUES (?,?,?,?,?,?)',
      ).run(it.title, v.summary, it.source, it.url, v.relevant, range);
      stored++;
    }
  }
  return stored;
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
  if (r.byRange) {
    return `原生 ${r.nativeStored} 条 + 范围 ${Object.keys(r.byRange).length} 个`;
  }
  return '';
}
