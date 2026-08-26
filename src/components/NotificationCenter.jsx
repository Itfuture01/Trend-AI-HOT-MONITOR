import { useEffect, useRef, useState } from 'react';
import { IconBell, IconMail, IconWarn, IconExternal } from './icons.jsx';
import { timeAgo } from '../lib.js';

const LS_KEY = 'trendmonitor.lastSeenAlert';

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

export default function NotificationCenter({ alerts = [] }) {
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(() => Number(localStorage.getItem(LS_KEY) || 0));
  const ref = useRef(null);

  const unread = alerts.filter((a) => a.id > lastSeen).length;

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      const maxId = alerts.reduce((m, a) => Math.max(m, a.id), 0);
      setLastSeen(maxId);
      localStorage.setItem(LS_KEY, String(maxId));
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        aria-label="通知中心"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-muted transition hover:border-white/20 hover:text-fg"
      >
        <IconBell className="h-4.5 w-4.5" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 font-mono text-[10px] font-bold leading-none text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="glass absolute right-0 top-12 z-50 w-[380px] max-w-[88vw] overflow-hidden rounded-2xl shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <span className="font-mono text-xs font-semibold tracking-wider text-fg">通知中心</span>
            <span className="font-mono text-[11px] text-muted">{alerts.length} 条</span>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {alerts.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <IconWarn className="mx-auto h-6 w-6 text-muted/40" />
                <p className="mt-2 text-xs text-muted">暂无通知</p>
              </div>
            ) : (
              alerts.slice(0, 30).map((a) => (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl px-3 py-2.5 transition hover:bg-white/5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded border border-warn/30 bg-warn/10 px-1.5 py-0.5 font-mono text-[10px] text-warn">
                      {a.keyword || '—'}
                    </span>
                    {channelBadges(a.sent_via)}
                  </div>
                  <div className="mt-1.5 flex items-start justify-between gap-2">
                    <span className="truncate-2 text-xs leading-snug text-fg">{a.title}</span>
                    <IconExternal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted/40" />
                  </div>
                  {a.ai_verdict && (
                    <p className="mt-1.5 line-clamp-2 font-mono text-[11px] leading-relaxed text-signal/70">
                      {a.ai_verdict}
                    </p>
                  )}
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted">
                    <span className="uppercase">{a.source}</span>
                    <span>{timeAgo(a.created_at)}</span>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
