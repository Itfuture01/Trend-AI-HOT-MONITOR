import { IconFlame, IconTrendingUp, IconSignal, IconHash } from './icons.jsx';

const CARDS = [
  { key: 'hotspots', label: '总热点', color: '#4ade80', Icon: IconSignal },
  { key: 'todayNew', label: '今日新增', color: '#38bdf8', Icon: IconTrendingUp },
  { key: 'urgent', label: '紧急热点', color: '#ef4444', Icon: IconFlame },
  { key: 'keywords', label: '监控关键词', color: '#f59e0b', Icon: IconHash },
];

export default function StatCards({ stats }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {CARDS.map(({ key, label, color, Icon }) => {
        const value = Number(stats?.[key]) || 0;
        return (
          <div
            key={key}
            className="glass animate-rise flex items-center gap-3.5 rounded-2xl p-4"
            style={{ borderColor: `${color}22` }}
          >
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ background: `${color}14`, color }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate font-mono text-[11px] uppercase tracking-wider text-muted">
                {label}
              </div>
              <div
                className="mt-0.5 font-mono text-3xl font-semibold leading-none"
                style={{ color, textShadow: `0 0 18px ${color}55` }}
              >
                {value}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
