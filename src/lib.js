// 相对时间（接受毫秒时间戳 或 SQLite localtime 字符串 "YYYY-MM-DD HH:MM:SS"）
export function timeAgo(input) {
  if (!input) return '';
  const d =
    typeof input === 'number'
      ? new Date(input)
      : new Date(String(input).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(input);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return '刚刚';
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
  return `${Math.floor(s / 86400)} 天前`;
}

export function scorePct(score) {
  return Math.round(Number(score) || 0); // score 已是 0~100
}

// 分数 → 信号色（绿=强 / 琥珀=中 / 灰=弱）
export function scoreColor(score) {
  const s = Number(score) || 0;
  if (s >= 70) return '#4ade80';
  if (s >= 40) return '#f59e0b';
  return '#94a3b8';
}

// 重要性分级元数据（紧急程度用英文标签）
export const LEVELS = {
  urgent: { label: 'URGENT', color: '#ef4444', rank: 4 },
  high: { label: 'HIGH', color: '#f59e0b', rank: 3 },
  medium: { label: 'MEDIUM', color: '#4ade80', rank: 2 },
  low: { label: 'LOW', color: '#64748b', rank: 1 },
};

export function levelMeta(level) {
  return LEVELS[level] || LEVELS.medium;
}

// 稳定的字符串哈希（用于雷达光点定位）
export function hashStr(str = '') {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h;
}
