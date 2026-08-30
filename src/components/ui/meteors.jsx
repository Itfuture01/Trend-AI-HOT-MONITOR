import { useMemo } from 'react';
import { cn } from '../../lib/cn.js';

// Aceternity Meteors：卡片内流星雨粒子（仅用于紧急热点）
// 用 useMemo 冻结随机位置，避免重渲染时抖动；纯 CSS 动画，不占 JS 主线程
export function Meteors({ number = 6, color = '#38bdf8', className }) {
  const meteors = useMemo(
    () =>
      Array.from({ length: number }, () => ({
        top: Math.random() * 55,
        left: 5 + Math.random() * 90,
        delay: Math.random() * 5,
        duration: 4.5 + Math.random() * 6,
      })),
    [number],
  );

  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden="true">
      {meteors.map((m, i) => (
        <span
          key={i}
          className="meteor"
          style={{
            top: `${m.top}%`,
            left: `${m.left}%`,
            animationDelay: `${m.delay}s`,
            animationDuration: `${m.duration}s`,
            '--meteor-color': color,
          }}
        />
      ))}
    </div>
  );
}
