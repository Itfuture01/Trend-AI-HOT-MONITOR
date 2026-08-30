import { useMemo } from 'react';
import { hashStr, scoreColor } from '../lib.js';
import { api } from '../api.js';

export default function Radar({ hotspots = [], range = '', total = null }) {
  const blips = useMemo(() => {
    return hotspots.slice(0, 16).map((h) => {
      const n = hashStr((h.title || '') + (h.url || ''));
      const angle = (n % 360) * (Math.PI / 180);
      const radius = 28 + (n % 62); // 28..89（viewBox 200，中心 100）
      const x = 100 + Math.cos(angle) * radius;
      const y = 100 + Math.sin(angle) * radius;
      const r = 2.2 + Math.min(3.6, ((Number(h.score) || 0) / 100) * 4);
      return { ...h, x, y, r };
    });
  }, [hotspots]);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[440px] select-none">
      {/* 同心圆 + 十字线 + 光点 */}
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="radar-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(74,222,128,0.10)" />
            <stop offset="70%" stopColor="rgba(74,222,128,0.02)" />
            <stop offset="100%" stopColor="rgba(74,222,128,0)" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="95" fill="url(#radar-bg)" />
        {[92, 70, 48, 26].map((r) => (
          <circle
            key={r}
            cx="100"
            cy="100"
            r={r}
            fill="none"
            stroke="rgba(148,163,184,0.20)"
            strokeWidth="0.6"
          />
        ))}
        <line x1="2" y1="100" x2="198" y2="100" stroke="rgba(148,163,184,0.12)" strokeWidth="0.5" />
        <line x1="100" y1="2" x2="100" y2="198" stroke="rgba(148,163,184,0.12)" strokeWidth="0.5" />
        <line x1="100" y1="100" x2="100" y2="2" stroke="rgba(148,163,184,0.12)" strokeWidth="0.5" />

        {/* 光点（可点击跳转原文） */}
        {blips.map((b, i) => (
          <a
            key={i}
            href={b.url}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer"
            onClick={() => b.id && api.viewHotspot(b.id).catch(() => {})}
          >
            {/* 透明扩大命中区，便于点击 */}
            <circle cx={b.x} cy={b.y} r={Math.max(b.r + 3.5, 9)} fill="transparent" />
            <circle
              cx={b.x}
              cy={b.y}
              r={b.r}
              fill={scoreColor(b.score)}
              className="blip-dot"
              style={{ animation: `blip ${2 + (i % 4) * 0.6}s ease-in-out infinite`, animationDelay: `${(i % 5) * 0.3}s` }}
            >
              <title>{`${b.title} · ${Math.round(b.score || 0)}%`}</title>
            </circle>
          </a>
        ))}
      </svg>

      {/* 旋转扫描扇面 */}
      <div
        className="radar-sweep pointer-events-none absolute inset-0 rounded-full"
        style={{
          background: 'conic-gradient(from 0deg, rgba(74,222,128,0.28), rgba(74,222,128,0) 72deg)',
          animation: 'radar-spin 4.5s linear infinite',
        }}
      />

      {/* 中心读数 */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="font-mono text-4xl font-semibold text-signal drop-shadow-[0_0_12px_rgba(74,222,128,0.6)]">
          {total ?? hotspots.length}
        </div>
        <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.25em] text-muted">
          {range || 'ALL'}
        </div>
        <div className="mt-0.5 text-[11px] text-muted/70">个热点信号</div>
      </div>
    </div>
  );
}
