import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';
import { normKey } from './collectors/filter.js';

fs.mkdirSync(config.dataDir, { recursive: true });
const DB_PATH = path.join(config.dataDir, 'trend.db');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 5000;');

db.exec(`
CREATE TABLE IF NOT EXISTS keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL UNIQUE,
  scope TEXT DEFAULT '',
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url_hash TEXT NOT NULL UNIQUE,
  title TEXT,
  url TEXT,
  source TEXT,
  snippet TEXT,
  first_seen TEXT DEFAULT (datetime('now','localtime')),
  last_seen TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS hotspots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  summary TEXT,
  source TEXT,
  url TEXT,
  score REAL DEFAULT 0,
  range TEXT DEFAULT '',
  first_seen TEXT DEFAULT (datetime('now','localtime')),
  last_seen TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword_id INTEGER,
  keyword TEXT,
  title TEXT,
  url TEXT,
  source TEXT,
  reason TEXT,
  ai_verdict TEXT,
  sent_via TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL UNIQUE,
  keys_json TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS sources (
  name TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 1,
  label TEXT,
  note TEXT
);
`);

// 数据源默认元数据（name 需与各采集器导出的 name 一致）
// 注：Google/Bing/DDG/Reddit/V2EX 在国内网络下需直连可达或代理可用，连不上会自动跳过（单源失败不影响其他源）。
const SOURCE_SEED = [
  ['Twitter', 'Twitter / X', '需 TWITTERAPI_IO_KEY'],
  ['Google', 'Google', '国内直连常不通，失败自动跳过'],
  ['Bing', 'Bing', '国内可直连，失败自动跳过'],
  ['DuckDuckGo', 'DuckDuckGo', '国内直连常不通，失败自动跳过'],
  ['HackerNews', 'Hacker News', '免配置'],
  ['搜狗', '搜狗', '近24h新内容(tsn=1)，免配置'],
  ['B站', 'B站', '热搜榜+搜索，免配置'],
  ['微博', '微博', '热搜榜可用，关键词搜索需登录'],
  ['GitHub', 'GitHub', 'Trending+仓库搜索，免配置'],
  ['V2EX', 'V2EX', '程序猿社区(sov2ex)，免配置'],
  ['360', '360搜索', '国内可直连，免配置'],
  ['百度', '百度', '热搜榜+搜索，偶发验证码自动跳过'],
  ['Reddit', 'Reddit', '需可直连/代理，失败自动跳过'],
  ['微信', '微信', '公众号内容(搜狗微信)，免配置'],
];
{
  const ins = db.prepare('INSERT OR IGNORE INTO sources (name, enabled, label, note) VALUES (?, 1, ?, ?)');
  for (const [name, label, note] of SOURCE_SEED) ins.run(name, label, note);
}

// ---- 迁移：hotspots 补充 AI 审核字段（level 分级 / model 模型 / views 查看次数 / genuine 真实性）----
{
  const cols = db.prepare('PRAGMA table_info(hotspots)').all().map((c) => c.name);
  if (!cols.includes('level')) db.exec("ALTER TABLE hotspots ADD COLUMN level TEXT DEFAULT 'medium'");
  if (!cols.includes('model')) db.exec("ALTER TABLE hotspots ADD COLUMN model TEXT DEFAULT ''");
  if (!cols.includes('views')) db.exec('ALTER TABLE hotspots ADD COLUMN views INTEGER DEFAULT 0');
  if (!cols.includes('genuine')) db.exec('ALTER TABLE hotspots ADD COLUMN genuine INTEGER DEFAULT 1');
  // 旧数据 score 为 0~1，统一迁移到 0~100
  db.exec('UPDATE hotspots SET score = ROUND(score * 100) WHERE score > 0 AND score <= 1');
}

// 迁移：items 表补充 norm_hash（规范化标题+来源 去重键）。
// 搜狗/360/百度等源 URL 每次抓取带随机参数，url_hash 无法跨轮去重；
// norm_hash 基于清洗后的标题+来源，稳定可去重。
{
  const cols = db.prepare('PRAGMA table_info(items)').all().map((c) => c.name);
  if (!cols.includes('norm_hash')) db.exec('ALTER TABLE items ADD COLUMN norm_hash TEXT');
  db.exec('CREATE INDEX IF NOT EXISTS idx_items_norm_hash ON items(norm_hash)');
}

// 规范化标题去重键：sha1(清洗后标题 + 来源)
export function hashNorm(title, source) {
  return crypto.createHash('sha1').update(normKey(title, source)).digest('hex');
}

// 旧数据（无 model 记录）按 score 回填重要性分级（幂等，新 AI 结果已带 level/model 不受影响）
db.exec(`UPDATE hotspots SET level = CASE
  WHEN score >= 80 THEN 'urgent'
  WHEN score >= 60 THEN 'high'
  WHEN score >= 40 THEN 'medium'
  ELSE 'low' END
  WHERE model = ''`);

// 迁移：旧版「热点范围」是固定 defaultRange（如 'AI编程'），现已统一为「监控关键词即范围」。
// 删除既不属于任何关键词、也不是 'trending' 的遗留 range 热点，避免出现幽灵标签。
db.exec(`
  DELETE FROM hotspots
  WHERE range != 'trending'
    AND range NOT IN (SELECT keyword FROM keywords)
`);

// 热点去重：按「标题 + 来源 + 范围」判断是否已存在。
// 搜狗等源的 URL 每次抓取都会变（带随机 UUID），不能只按 URL 去重。
// 已存在则刷新 last_seen 并返回 id，不存在返回 null。
export function touchHotspot(title, source, range) {
  const t = (title || '').trim().toLowerCase();
  const s = source || '';
  const r = range || '';
  const row = db
    .prepare(
      "SELECT id FROM hotspots WHERE COALESCE(lower(trim(title)),'') = ? AND COALESCE(source,'') = ? AND COALESCE(range,'') = ? LIMIT 1",
    )
    .get(t, s, r);
  if (row) {
    db.prepare("UPDATE hotspots SET last_seen = datetime('now','localtime') WHERE id = ?").run(row.id);
    return row.id;
  }
  return null;
}

// 去重键：标题 + URL 规范化后 sha1（对 URL 稳定的源有效）
export function hashItem(title, url) {
  const norm = `${(title || '').trim().toLowerCase()}||${(url || '').trim().toLowerCase()}`;
  return crypto.createHash('sha1').update(norm).digest('hex');
}

// 返回 true 表示新条目（首次见到），false 表示已存在（去重命中）
export function dedupeItem({ title, url, source, snippet }) {
  // 优先用「规范化标题 + 来源」去重：搜狗/360/百度等 URL 每次带随机参数，
  // title 也带「 - 站点」后缀，这两者需清洗后才能作为稳定去重键。
  const h = hashItem(title, url);
  const nh = hashNorm(title, source);
  const existing = db
    .prepare('SELECT id FROM items WHERE url_hash = ? OR norm_hash = ?')
    .get(h, nh);
  if (existing) {
    db.prepare("UPDATE items SET last_seen = datetime('now','localtime') WHERE id = ?").run(existing.id);
    return false;
  }
  db.prepare('INSERT OR IGNORE INTO items (url_hash, norm_hash, title, url, source, snippet) VALUES (?,?,?,?,?,?)')
    .run(h, nh, title ?? null, url ?? null, source ?? null, snippet ?? null);
  return true;
}

export { db, DB_PATH };
