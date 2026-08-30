import { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';
import HotCard from './HotCard.jsx';
import Pagination from './Pagination.jsx';
import { IconSearch, IconX } from './icons.jsx';

export default function SearchView() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hotspots, setHotspots] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);

  function search(q, pg = 1) {
    setQuery(q);
    setPage(pg);
  }

  useEffect(() => {
    if (!query) {
      setHotspots([]);
      setTotal(0);
      setTotalPages(1);
      return;
    }
    let active = true;
    setLoading(true);
    api
      .hotspots('', page, 20, query)
      .then((h) => {
        if (!active) return;
        setHotspots(h.hotspots || []);
        setTotal(h.total || 0);
        setTotalPages(h.totalPages || 1);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query, page]);

  function handleChange(e) {
    const v = e.target.value;
    setInput(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => search(v, 1), 300);
  }

  function clear() {
    setInput('');
    clearTimeout(timer.current);
    search('', 1);
  }

  return (
    <section className="glass rounded-2xl p-5">
      {/* 大号检索框 */}
      <div className="relative mx-auto max-w-2xl">
        <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={input}
          onChange={handleChange}
          autoFocus
          placeholder="在已发现的热点里模糊检索（标题 / 摘要 / 来源），按相似度排序…"
          className="w-full rounded-2xl border border-white/10 bg-white/[0.02] py-3.5 pl-12 pr-12 font-mono text-sm text-fg outline-none transition placeholder:text-muted/50 focus:border-accent/50 focus:shadow-[0_0_24px_rgba(34,211,238,0.15)]"
        />
        {input && (
          <button
            onClick={clear}
            aria-label="清空搜索"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition hover:text-fg"
          >
            <IconX className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="mt-5">
        {!query ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-16 text-center">
            <p className="font-mono text-sm text-muted">输入关键词开始检索</p>
            <p className="mt-1 text-xs text-muted/70">支持模糊匹配，结果按相似度从高到低排序</p>
          </div>
        ) : loading ? (
          <div className="px-4 py-16 text-center">
            <p className="font-mono text-sm text-signal">检索中…</p>
          </div>
        ) : hotspots.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-16 text-center">
            <p className="font-mono text-sm text-muted">NO MATCH</p>
            <p className="mt-1 text-xs text-muted/70">没有匹配「{query}」的热点，换个关键词试试</p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-mono text-sm font-semibold tracking-wider text-fg">
                <span className="inline-block h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_currentColor]" />
                检索结果
              </h2>
              <span className="font-mono text-xs text-muted">共 {total} 条</span>
            </div>
            <div className="grid grid-cols-1 gap-2.5">
              {hotspots.map((h) => (
                <HotCard key={h.id} h={h} />
              ))}
            </div>
            {totalPages > 1 && <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />}
          </>
        )}
      </div>
    </section>
  );
}
