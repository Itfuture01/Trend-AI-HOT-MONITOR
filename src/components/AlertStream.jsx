import { useState } from 'react';
import { timeAgo } from '../lib.js';
import { api } from '../api.js';
import { IconBell, IconMail, IconWarn, IconExternal, IconTrash } from './icons.jsx';

function channelBadges(sentVia = '') {
  const via = (sentVia || '').split(',').filter(Boolean);
  if (!via.length || via[0] === 'none') return null;
  return (
    <span className="flex items-center gap-1">
      {via.includes('email') && <IconMail className="h-3 w-3 text-muted/60" />}
      {via.includes('push') && <IconBell className="h-3 w-3 text-muted/60" />}
    </span>
  );
}

export default function AlertStream({ alerts = [], onCleared }) {
  const [busy, setBusy] = useState(false);

  async function clearAll() {
    if (busy || alerts.length === 0) return;
    setBusy(true);
    try {
      await api.clearAlerts();
      onCleared?.();
    } catch (e) {
      console.error('[clearAlerts]', e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass flex max-h-[70vh] flex-col rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-mono text-sm font-semibold tracking-wider text-fg">
          <IconBell className="h-4 w-4 text-warn" />
          实时告警流
        </h2>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted">{alerts.length}</span>
          {alerts.length > 0 && (
            <button
              onClick={clearAll}
              disabled={busy}
              aria-label="清空告警"
              title="清空告警"
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted/50 transition hover:text-danger disabled:opacity-40"
            >
              <IconTrash className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="-mr-1 space-y-2 overflow-y-auto pr-1">
        {alerts.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center">
            <IconWarn className="mx-auto h-6 w-6 text-muted/40" />
            <p className="mt-2 text-xs text-muted">暂无告警</p>
          </div>
        )}
        {alerts.map((a) => (
          <div key={a.id} className="animate-rise rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded border border-warn/30 bg-warn/10 px-1.5 py-0.5 font-mono text-[10px] text-warn">
                {a.keyword || '—'}
              </span>
              {channelBadges(a.sent_via)}
            </div>
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 flex items-start justify-between gap-2"
            >
              <span className="truncate-2 text-xs leading-snug text-fg hover:text-signal">{a.title}</span>
              <IconExternal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted/40" />
            </a>
            {a.ai_verdict && (
              <p className="mt-1.5 line-clamp-2 font-mono text-[11px] leading-relaxed text-signal/70">
                {a.ai_verdict}
              </p>
            )}
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted">
              <span className="uppercase">{a.source}</span>
              <span>{timeAgo(a.created_at)}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
