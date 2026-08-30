export default function Pagination({ page, totalPages, total, onPage }) {
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
