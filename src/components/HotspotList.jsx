import { scorePct, scoreColor, timeAgo } from '../lib.js';
import { IconExternal, IconGlobe } from './icons.jsx';

function Tab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1.5 font-mono text-xs transition ${
        active ? 'bg-accent/15 text-signal' : 'text-muted hover:bg-white/5 hover:text-fg'
      }`}
    >
      {label}
    </button>
  );
}

function HotCard({ h }) {
  const pct = scorePct(h.score);
  return (
    <a
      href={h.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl border border-white/5 bg-white/[0.02] p-3.5 transition hover:border-accent/30 hover:bg-white/[0.04]"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="truncate-2 text-sm font-medium leading-snug text-fg group-hover:text-signal">
          {h.title}
        </h3>
        <IconExternal className="mt-0.5 h-4 w-4 shrink-0 text-muted/40 transition group-hover:text-signal" />
      </div>

      {h.summary && <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">{h.summary}</p>}

      <div className="mt-3 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: scoreColor(h.score) }}
          />
        </div>
        <span className="font-mono text-[11px]" style={{ color: scoreColor(h.score) }}>
          {pct}%
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
        <span className="rounded border border-white/10 px-1.5 py-0.5 font-mono uppercase tracking-wide">
          {h.source || '—'}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <IconGlobe className="h-3 w-3" />
          {timeAgo(h.last_seen)}
        </span>
      </div>
    </a>
  );
}

export default function HotspotList({ hotspots = [], ranges = [], range = '', onRange }) {
  return (
    <section className="glass rounded-2xl p-4">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <h2 className="mr-1 flex items-center gap-2 font-mono text-sm font-semibold tracking-wider text-fg">
          <span className="inline-block h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_currentColor]" />
          热点信号
        </h2>
        <Tab label="全部" active={range === ''} onClick={() => onRange('')} />
        {ranges.map((r) => (
          <Tab key={r} label={r} active={range === r} onClick={() => onRange(r)} />
        ))}
      </div>

      {hotspots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center">
          <p className="font-mono text-sm text-muted">NO SIGNAL</p>
          <p className="mt-1 text-xs text-muted/70">暂无热点，点击右上角「立即扫描」或等待定时任务</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {hotspots.map((h) => (
            <HotCard key={h.id} h={h} />
          ))}
        </div>
      )}
    </section>
  );
}
