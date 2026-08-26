import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';

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
const SOURCE_SEED = [
  ['Twitter', 'Twitter / X', '需 TWITTERAPI_IO_KEY'],
  ['Google', 'Google', '国内网络需代理'],
  ['Bing', 'Bing', '国内网络需代理'],
  ['DuckDuckGo', 'DuckDuckGo', '国内网络需代理'],
  ['HackerNews', 'Hacker News', '免配置'],
  ['搜狗', '搜狗', '免配置'],
  ['B站', 'B站', '免配置'],
  ['微博', '微博', '热搜榜可用，关键词搜索需登录'],
];
{
  const ins = db.prepare('INSERT OR IGNORE INTO sources (name, enabled, label, note) VALUES (?, 1, ?, ?)');
  for (const [name, label, note] of SOURCE_SEED) ins.run(name, label, note);
}

// 去重键：标题 + URL 规范化后 sha1
export function hashItem(title, url) {
  const norm = `${(title || '').trim().toLowerCase()}||${(url || '').trim().toLowerCase()}`;
  return crypto.createHash('sha1').update(norm).digest('hex');
}

// 返回 true 表示新条目（首次见到），false 表示已存在（去重命中）
export function dedupeItem({ title, url, source, snippet }) {
  const h = hashItem(title, url);
  const existing = db.prepare('SELECT id FROM items WHERE url_hash = ?').get(h);
  if (existing) {
    db.prepare("UPDATE items SET last_seen = datetime('now','localtime') WHERE id = ?").run(existing.id);
    return false;
  }
  db.prepare('INSERT OR IGNORE INTO items (url_hash, title, url, source, snippet) VALUES (?,?,?,?,?)')
    .run(h, title ?? null, url ?? null, source ?? null, snippet ?? null);
  return true;
}

export { db, DB_PATH };
