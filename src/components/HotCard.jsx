import { useState } from 'react';
import { scorePct, scoreColor, levelMeta, timeAgo } from '../lib.js';
import { api } from '../api.js';
import { Spotlight } from './ui/spotlight.jsx';
import { Meteors } from './ui/meteors.jsx';
import { IconExternal, IconEye, IconCpu } from './icons.jsx';

export default function HotCard({ h }) {
  const pct = scorePct(h.score);
  const lv = levelMeta(h.level);
  const [delta, setDelta] = useState(0);
  const views = (h.views || 0) + delta;
  const urgent = h.level === 'urgent';

  return (
    <Spotlight
      color="rgba(56, 189, 248, 0.12)"
      className="animate-rise overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] transition-colors hover:border-accent/30 hover:bg-white/[0.04]"
    >
      {/* 紧急热点：流星雨粒子 */}
      {urgent && <Meteors number={6} className="opacity-70" />}

      <a
        href={h.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          setDelta((x) => x + 1);
          api.viewHotspot(h.id).catch(() => {});
        }}
        className="relative block p-4"
      >
        <div className="flex items-start gap-3">
          {/* 热点等级 */}
          <span
            className="mt-0.5 shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-semibold"
            style={{ color: lv.color, borderColor: `${lv.color}55`, background: `${lv.color}14` }}
          >
            {lv.label}
          </span>

          <div className="min-w-0 flex-1">
            <h3 className="truncate-2 text-sm font-medium leading-snug text-fg group-hover:text-signal">
              {h.title}
            </h3>
            {/* AI 摘要 */}
            {h.summary && (
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">{h.summary}</p>
            )}
          </div>

          <IconExternal className="mt-0.5 h-4 w-4 shrink-0 text-muted/40 transition group-hover:text-signal" />
        </div>

        {/* 相关性 */}
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: scoreColor(h.score) }}
            />
          </div>
          <span className="font-mono text-sm font-semibold" style={{ color: scoreColor(h.score) }}>
            {pct}%
          </span>
        </div>

        {/* 元信息：来源（显）/ 监控关键词（淡）/ 模型 / 查看次数 / 监控时间 */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted">
          <span className="rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 font-mono uppercase tracking-wide text-signal">
            {h.source || '—'}
          </span>
          {h.range && (
            <span className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-muted">
              {h.range === 'trending' ? '热搜榜' : h.range}
            </span>
          )}
          {h.model && (
            <span className="flex items-center gap-1 font-mono">
              <IconCpu className="h-3 w-3" />
              {h.model}
            </span>
          )}
          <span className="flex items-center gap-1 font-mono">
            <IconEye className="h-3 w-3" />
            {views}
          </span>
          <span className="ml-auto font-mono" title={h.first_seen || h.last_seen}>
            监控 {timeAgo(h.first_seen || h.last_seen)}
          </span>
        </div>
      </a>
    </Spotlight>
  );
}
