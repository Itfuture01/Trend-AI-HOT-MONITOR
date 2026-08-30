import { useState, useEffect, useRef } from 'react';
import { scorePct, scoreColor, levelMeta, timeAgo } from '../lib.js';
import { api } from '../api.js';
import { Spotlight } from './ui/spotlight.jsx';
import { IconExternal, IconEye, IconCpu, IconSearch, IconX } from './icons.jsx';

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

function Pagination({ page, totalPages, total, onPage }) {
  return (
    <div className="mt-4 flex items-center justify-center gap-3 border-t border-white/5 pt-4 font-mono text-xs">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="rounded-lg border border-white/10 px-3 py-1.5 text-muted transition hover:border-white/20 hover:text-fg disabled:cursor-not-allowed disabled:opacity-30"
      >
        ← 上一页
      </button>
      <span className="text-muted">
        第 <span className="font-semibold text-signal">{page}</span> / {totalPages} 页 · 共 {total} 条
      </span>
      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        className="rounded-lg border border-white/10 px-3 py-1.5 text-muted transition hover:border-white/20 hover:text-fg disabled:cursor-not-allowed disabled:opacity-30"
      >
        下一页 →
      </button>
    </div>
  );
}

function HotCard({ h }) {
  const pct = scorePct(h.score);
  const lv = levelMeta(h.level);
  const [delta, setDelta] = useState(0);
  const views = (h.views || 0) + delta;

  return (
    <Spotlight
      color="rgba(74, 222, 128, 0.10)"
      className="animate-rise rounded-xl border border-white/5 bg-white/[0.02] transition-colors hover:border-accent/30 hover:bg-white/[0.04]"
    >
      <a
        href={h.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          setDelta((x) => x + 1);
          api.viewHotspot(h.id).catch(() => {});
        }}
        className="block p-4"
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

      {/* 元信息：来源 / 模型 / 查看次数 / 时间 */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted">
        <span className="rounded border border-white/10 px-1.5 py-0.5 font-mono uppercase tracking-wide">
          {h.source || '—'}
        </span>
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
        <span className="ml-auto font-mono">{timeAgo(h.last_seen)}</span>
      </div>
      </a>
    </Spotlight>
  );
}

export default function HotspotList({ hotspots = [], ranges = [], range = '', onRange, query = '', onQuery, page = 1, total = 0, totalPages = 1, onPage }) {
  const [input, setInput] = useState(query);
  const timer = useRef(null);

  // 外部 query 变化（如清空）时同步输入框
  useEffect(() => {
    setInput(query);
  }, [query]);

  function handleChange(e) {
    const v = e.target.value;
    setInput(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onQuery(v), 300);
  }

  function clearSearch() {
    setInput('');
    clearTimeout(timer.current);
    onQuery('');
  }

  return (
    <section className="glass rounded-2xl p-4">
      {/* 模糊检索框 */}
      <div className="relative mb-3">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={input}
          onChange={handleChange}
          placeholder="模糊检索热点（标题 / 摘要 / 来源），按相似度排序…"
          className="w-full rounded-lg border border-white/10 bg-white/[0.02] py-2 pl-9 pr-8 font-mono text-xs text-fg outline-none transition placeholder:text-muted/60 focus:border-accent/40"
        />
        {input && (
          <button
            onClick={clearSearch}
            aria-label="清空搜索"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted transition hover:text-fg"
          >
            <IconX className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <h2 className="mr-1 flex items-center gap-2 font-mono text-sm font-semibold tracking-wider text-fg">
          <span className="inline-block h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_currentColor]" />
          {query ? '检索结果' : '热点信号'}
        </h2>
        <Tab label="全部" active={range === ''} onClick={() => onRange('')} />
        {ranges.map((r) => (
          <Tab key={r} label={r} active={range === r} onClick={() => onRange(r)} />
        ))}
      </div>

      {hotspots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center">
          <p className="font-mono text-sm text-muted">{query ? 'NO MATCH' : 'NO SIGNAL'}</p>
          <p className="mt-1 text-xs text-muted/70">
            {query ? `没有匹配「${query}」的热点，换个关键词试试` : '暂无热点，点击右上角「立即扫描」或等待定时任务'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {hotspots.map((h) => (
            <HotCard key={h.id} h={h} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} total={total} onPage={onPage} />
      )}
    </section>
  );
}
