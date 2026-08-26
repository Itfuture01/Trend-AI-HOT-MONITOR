import { useState } from 'react';
import { api } from '../api.js';
import { IconPlus, IconTrash, IconPower } from './icons.jsx';

function PanelHeader({ title, count, accent = 'text-signal' }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 font-mono text-sm font-semibold tracking-wider text-fg">
        <span className={`inline-block h-2 w-2 rounded-full ${accent} shadow-[0_0_8px_currentColor]`} />
        {title}
      </h2>
      <span className="font-mono text-xs text-muted">{count}</span>
    </div>
  );
}

export default function KeywordPanel({ keywords = [], onChanged }) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function add(e) {
    e.preventDefault();
    const kw = input.trim();
    if (!kw) return;
    setBusy(true);
    setError('');
    try {
      await api.addKeyword(kw);
      setInput('');
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(kw) {
    try {
      await api.updateKeyword(kw.id, { enabled: kw.enabled ? 0 : 1 });
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(kw) {
    try {
      await api.removeKeyword(kw.id);
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="glass rounded-2xl p-4">
      <PanelHeader title="监控关键词" count={`${keywords.length} 项`} />

      <form onSubmit={add} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入关键词，如 GPT-5"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-fg placeholder:text-muted/50 outline-none transition focus:border-accent/60"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="添加关键词"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-[#052e16] transition hover:bg-signal disabled:opacity-40"
        >
          <IconPlus className="h-4 w-4" />
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      <ul className="mt-3 space-y-1.5">
        {keywords.length === 0 && (
          <li className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-muted">
            暂无关键词，添加后开始监控
          </li>
        )}
        {keywords.map((kw) => (
          <li
            key={kw.id}
            className="group flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 transition hover:border-white/10"
          >
            <button
              onClick={() => toggle(kw)}
              aria-label={kw.enabled ? '停用' : '启用'}
              title={kw.enabled ? '已启用（点击停用）' : '已停用（点击启用）'}
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition ${
                kw.enabled ? 'text-signal' : 'text-muted/40'
              }`}
            >
              <IconPower className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <div className={`truncate text-sm ${kw.enabled ? 'text-fg' : 'text-muted/60 line-through'}`}>
                {kw.keyword}
              </div>
              <div className="font-mono text-[11px] text-muted">
                {kw.scope || '—'} · 告警 {kw.alert_count ?? 0}
              </div>
            </div>
            <button
              onClick={() => remove(kw)}
              aria-label="删除关键词"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted/40 opacity-0 transition hover:text-danger group-hover:opacity-100"
            >
              <IconTrash className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
