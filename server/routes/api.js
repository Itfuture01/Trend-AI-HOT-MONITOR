import { Router } from 'express';
import { db } from '../db.js';
import { config } from '../config.js';
import { aiEnabled } from '../ai.js';
import { manualScan, getStatus } from '../scheduler.js';
import {
  emailEnabled,
  testEmail,
  testPush,
  vapidPublicKey,
} from '../notify.js';
import { broadcast } from '../events.js';

const router = Router();

// ---------- 热点 ----------
// 按重要性分级排序：urgent > high > medium > low，同级再按相关性、时间
const LEVEL_ORDER = `CASE level WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END`;

router.get('/hotspots', (req, res) => {
  const range = req.query.range || '';
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;
  const where = range ? 'WHERE range = ?' : '';
  const params = range ? [range] : [];

  const total = db.prepare(`SELECT count(*) c FROM hotspots ${where}`).get(...params).c;
  const rows = db
    .prepare(
      `SELECT * FROM hotspots ${where} ORDER BY ${LEVEL_ORDER} DESC, score DESC, last_seen DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset);
  const ranges = db.prepare('SELECT DISTINCT range FROM hotspots').all().map((r) => r.range);
  res.json({
    hotspots: rows,
    ranges,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

// 查看次数 +1（点击跳转源页面时调用）
router.post('/hotspots/:id/view', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('UPDATE hotspots SET views = views + 1 WHERE id = ?').run(id);
  const row = db.prepare('SELECT views FROM hotspots WHERE id = ?').get(id);
  res.json({ ok: true, views: row?.views ?? 0 });
});

// ---------- 关键词 ----------
router.get('/keywords', (req, res) => {
  const rows = db
    .prepare(
      'SELECT k.*, (SELECT count(*) FROM alerts a WHERE a.keyword_id = k.id) AS alert_count FROM keywords k ORDER BY k.id DESC',
    )
    .all();
  res.json({ keywords: rows });
});

router.post('/keywords', (req, res) => {
  const { keyword, scope = '', enabled = 1 } = req.body || {};
  const kw = (keyword || '').trim();
  if (!kw) return res.status(400).json({ error: 'keyword 不能为空' });
  try {
    const info = db
      .prepare('INSERT INTO keywords (keyword, scope, enabled) VALUES (?,?,?)')
      .run(kw, scope, enabled ? 1 : 0);
    const created = db.prepare('SELECT * FROM keywords WHERE id = ?').get(info.lastInsertRowid);
    res.json({ ok: true, keyword: created });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: '关键词已存在' });
    }
    res.status(500).json({ error: e.message });
  }
});

router.patch('/keywords/:id', (req, res) => {
  const id = Number(req.params.id);
  const { enabled, scope } = req.body || {};
  const row = db.prepare('SELECT * FROM keywords WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: '关键词不存在' });
  db.prepare('UPDATE keywords SET enabled = ?, scope = ? WHERE id = ?').run(
    enabled !== undefined ? (enabled ? 1 : 0) : row.enabled,
    scope !== undefined ? scope : row.scope,
    id,
  );
  res.json({ ok: true, keyword: db.prepare('SELECT * FROM keywords WHERE id = ?').get(id) });
});

router.delete('/keywords/:id', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM keywords WHERE id = ?').run(id);
  res.json({ ok: true });
});

// ---------- 数据源 ----------
router.get('/sources', (req, res) => {
  const rows = db.prepare('SELECT * FROM sources ORDER BY name').all();
  res.json({ sources: rows });
});

router.patch('/sources/:name', (req, res) => {
  const name = req.params.name;
  if (!name) return res.status(400).json({ error: '缺少 source name' });
  const { enabled } = req.body || {};
  db.prepare('INSERT OR IGNORE INTO sources (name, enabled) VALUES (?, 1)').run(name);
  if (enabled !== undefined) {
    db.prepare('UPDATE sources SET enabled = ? WHERE name = ?').run(enabled ? 1 : 0, name);
  }
  const source = db.prepare('SELECT * FROM sources WHERE name = ?').get(name);
  res.json({ ok: true, source });
});

// ---------- 手动扫描（后台执行，立即返回）----------
router.post('/scan', (req, res) => {
  res.json({ started: true, at: Date.now() });
  manualScan()
    .then((r) => broadcast('scan-done', r))
    .catch((e) => broadcast('scan-done', { error: e.message }));
});

// ---------- 告警 ----------
router.get('/alerts', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const rows = db.prepare('SELECT * FROM alerts ORDER BY id DESC LIMIT ?').all(limit);
  res.json({ alerts: rows });
});

// ---------- 浏览器推送 ----------
router.get('/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapidPublicKey() });
});

router.post('/push/subscribe', (req, res) => {
  const { endpoint, keys } = req.body?.subscription || {};
  if (!endpoint) return res.status(400).json({ error: '缺少 subscription.endpoint' });
  db.prepare('INSERT OR REPLACE INTO push_subscriptions (endpoint, keys_json) VALUES (?,?)').run(
    endpoint,
    JSON.stringify(keys || {}),
  );
  res.json({ ok: true });
});

router.post('/push/unsubscribe', (req, res) => {
  const endpoint = req.body?.endpoint;
  if (endpoint) db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  res.json({ ok: true });
});

// ---------- 测试通知 ----------
router.post('/test-email', async (req, res) => {
  const r = await testEmail();
  res.json(r);
});

router.post('/test-push', async (req, res) => {
  const r = await testPush();
  res.json(r);
});

// ---------- 统计 / 状态 ----------
router.get('/stats', (req, res) => {
  const keywords = db.prepare('SELECT count(*) c FROM keywords').get().c;
  const hotspots = db.prepare('SELECT count(*) c FROM hotspots').get().c;
  const todayNew = db.prepare("SELECT count(*) c FROM hotspots WHERE date(first_seen) = date('now','localtime')").get().c;
  const urgent = db.prepare("SELECT count(*) c FROM hotspots WHERE level = 'urgent'").get().c;
  const high = db.prepare("SELECT count(*) c FROM hotspots WHERE level = 'high'").get().c;
  const alerts = db.prepare('SELECT count(*) c FROM alerts').get().c;
  const subscriptions = db.prepare('SELECT count(*) c FROM push_subscriptions').get().c;
  const sourcesTotal = db.prepare('SELECT count(*) c FROM sources').get().c;
  const sourcesEnabled = db.prepare('SELECT count(*) c FROM sources WHERE enabled = 1').get().c;
  res.json({
    keywords,
    hotspots,
    todayNew,
    urgent,
    high,
    alerts,
    subscriptions,
    sourcesTotal,
    sourcesEnabled,
    aiEnabled: aiEnabled(),
    emailEnabled: emailEnabled(),
    twitterEnabled: !!config.twitter.apiKey,
    hasProxy: !!(process.env.HTTP_PROXY || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.https_proxy),
    model: config.openrouter.model,
    defaultRange: config.defaultRange,
    status: getStatus(),
  });
});

export default router;
