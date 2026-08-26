import { IconRadar, IconScan, IconGear } from './icons.jsx';
import { timeAgo } from '../lib.js';

function Dot({ on, color = '#4ade80' }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ background: on ? color : '#334155', boxShadow: on ? `0 0 8px ${color}` : 'none' }}
    />
  );
}

function Chip({ label, on }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted">
      <Dot on={on} />
      <span className="font-mono uppercase tracking-wider">{label}</span>
    </div>
  );
}

export default function StatusBar({ stats, connected, scanning, onScan, onOpenSettings }) {
  const status = stats?.status || {};
  const last = status.lastRun?.manual || status.lastRun?.hotspot || status.lastRun?.keyword;

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0f172a]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-3 lg:px-6">
        {/* 品牌 */}
        <div className="flex items-center gap-2.5">
          <IconRadar className="h-6 w-6 text-signal" />
          <div className="leading-tight">
            <div className="font-mono text-sm font-semibold tracking-[0.2em] text-fg">TREND&nbsp;MONITOR</div>
            <div className="text-[11px] text-muted">AI 热点雷达</div>
          </div>
        </div>

        {/* 状态指示灯（桌面） */}
        <div className="ml-4 hidden items-center gap-4 md:flex">
          <Chip label="AI" on={stats?.aiEnabled} />
          <Chip label="Mail" on={stats?.emailEnabled} />
          <Chip label="Push" on={(stats?.subscriptions || 0) > 0} />
          <Chip label="X" on={stats?.twitterEnabled} color="#60a5fa" />
          <Chip label="Proxy" on={stats?.hasProxy} color="#a78bfa" />
          <Chip label="Live" on={connected} />
        </div>

        {/* 右侧操作 */}
        <div className="ml-auto flex items-center gap-3">
          {last && (
            <span className="hidden font-mono text-xs text-muted sm:inline">
              上次扫描 · {timeAgo(last)}
            </span>
          )}
          <button
            onClick={onScan}
            disabled={scanning}
            className="group flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 font-mono text-xs font-semibold text-[#052e16] transition hover:bg-signal disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconScan className={`h-4 w-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? '扫描中' : '立即扫描'}
          </button>
          <button
            onClick={onOpenSettings}
            aria-label="设置"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-muted transition hover:border-white/20 hover:text-fg"
          >
            <IconGear className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
