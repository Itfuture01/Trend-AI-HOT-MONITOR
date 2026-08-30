import HotCard from './HotCard.jsx';
import Pagination from './Pagination.jsx';

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

export default function HotspotList({ hotspots = [], ranges = [], range = '', onRange, page = 1, total = 0, totalPages = 1, onPage }) {
  return (
    <section className="glass rounded-2xl p-4">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <h2 className="mr-1 flex items-center gap-2 font-mono text-sm font-semibold tracking-wider text-fg">
          <span className="inline-block h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_currentColor]" />
          热点信号
        </h2>
        <Tab label="全部" active={range === ''} onClick={() => onRange('')} />
        {ranges.map((r) => (
          <Tab key={r} label={r === 'trending' ? '热搜榜' : r} active={range === r} onClick={() => onRange(r)} />
        ))}
      </div>

      {hotspots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center">
          <p className="font-mono text-sm text-muted">NO SIGNAL</p>
          <p className="mt-1 text-xs text-muted/70">暂无热点，点击右上角「立即扫描」或等待定时任务</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {hotspots.map((h) => (
            <HotCard key={h.id} h={h} />
          ))}
        </div>
      )}

      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} total={total} onPage={onPage} />}
    </section>
  );
}
