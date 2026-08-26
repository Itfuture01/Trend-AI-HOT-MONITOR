import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');

// 简单 .env 解析（KEY=VALUE，支持注释与引号）
function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const fileEnv = parseEnvFile(ENV_PATH);

// 将 .env 注入 process.env（真实环境变量优先），
// 供直接读 process.env 的模块（如 http.js 的 EnvHttpProxyAgent、stats 的 hasProxy）使用。
for (const [k, v] of Object.entries(fileEnv)) {
  if (process.env[k] === undefined || process.env[k] === '') {
    process.env[k] = v;
  }
}

// 真实环境变量优先于 .env
function get(key, fallback = '') {
  const v = process.env[key];
  if (v !== undefined && v !== '') return v;
  if (fileEnv[key] !== undefined && fileEnv[key] !== '') return fileEnv[key];
  return fallback;
}

// 向 .env 追加/更新一个键（用于 VAPID 自动生成）
function appendToEnv(key, value) {
  const line = `${key}=${value}`;
  const exists = fs.existsSync(ENV_PATH);
  let content = exists ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(content)) {
    content = content.replace(re, line);
  } else {
    content = content.replace(/\s*$/, '') + '\n' + line + '\n';
  }
  fs.writeFileSync(ENV_PATH, content);
  fileEnv[key] = value;
}

const config = {
  root: ROOT,
  envPath: ENV_PATH,
  port: Number(get('PORT', '3000')),
  dataDir: get('DATA_DIR', path.join(ROOT, 'data')),

  openrouter: {
    apiKey: get('OPENROUTER_API_KEY'),
    model: get('OPENROUTER_MODEL', 'google/gemini-2.0-flash-001'),
    baseUrl: get('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
  },

  twitter: {
    apiKey: get('TWITTERAPI_IO_KEY'),
    baseUrl: 'https://api.twitterapi.io',
  },

  smtp: {
    host: get('SMTP_HOST'),
    port: Number(get('SMTP_PORT', '465')),
    secure: get('SMTP_SECURE', 'true') === 'true',
    user: get('SMTP_USER'),
    pass: get('SMTP_PASS'),
    from: get('SMTP_FROM'),
    to: get('SMTP_TO'),
  },

  monitorIntervalMin: Number(get('MONITOR_INTERVAL_MIN', '5')),
  hotspotIntervalMin: Number(get('HOTSPOT_INTERVAL_MIN', '15')),
  // 兼容旧配置：<=1 视为 0~1 比例，统一归一化到 0~100 评分
  aiThreshold: (() => {
    const v = Number(get('AI_THRESHOLD', '0.6'));
    return Number.isFinite(v) && v <= 1 ? Math.round(v * 100) : v;
  })(),
  defaultRange: get('DEFAULT_RANGE', 'AI编程'),

  vapidPublicKey: get('VAPID_PUBLIC_KEY'),
  vapidPrivateKey: get('VAPID_PRIVATE_KEY'),
  vapidSubject: get('VAPID_SUBJECT', 'mailto:admin@example.com'),
};

export { config, get, appendToEnv, ROOT, ENV_PATH };
