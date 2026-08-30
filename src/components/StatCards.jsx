import { BentoGrid } from './ui/bento-grid.jsx';
import { Spotlight } from './ui/spotlight.jsx';
import { IconFlame, IconTrendingUp, IconSignal, IconHash } from './icons.jsx';

const CARDS = [
  { key: 'hotspots', label: '总热点', color: '#4ade80', Icon: IconSignal },
  { key: 'todayNew', label: '今日新增', color: '#22d3ee', Icon: IconTrendingUp },
  { key: 'urgent', label: '紧急热点', color: '#ef4444', Icon: IconFlame },
  { key: 'keywords', label: '监控关键词', color: '#f59e0b', Icon: IconHash },
];

export default function StatCards({ stats }) {
  return (
    <BentoGrid>
      {CARDS.map(({ key, label, color, Icon }) => {
        const value = Number(stats?.[key]) || 0;
        return (
          <Spotlight
            key={key}
            color={`${color}1c`}
            className="rounded-2xl border border-white/8 bg-white/[0.02]"
          >
            <div className="flex items-center gap-3.5 p-4">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ background: `${color}1a`, color, boxShadow: `0 0 20px ${color}33` }}
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
          </Spotlight>
        );
      })}
    </BentoGrid>
  );
}
