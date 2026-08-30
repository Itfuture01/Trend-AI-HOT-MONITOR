import { motion, useReducedMotion } from 'framer-motion';

// 极光背景（Aceternity 风格）：固定全屏、多层蓝青光斑缓慢漂移，尊重 prefers-reduced-motion
// 配色：深空蓝 → 天蓝 → 青（科技感），顶部叠加一束蓝色聚光灯（Spotlight）
const BLOBS = [
  { color: '#3b82f6', left: '-12%', top: '-14%', scale: 1.1, dur: 20, delay: 0 },
  { color: '#38bdf8', left: '26%', top: '8%', scale: 1.25, dur: 26, delay: 3 },
  { color: '#22d3ee', left: '58%', top: '-8%', scale: 1.0, dur: 30, delay: 6 },
  { color: '#67e8f9', left: '82%', top: '12%', scale: 1.15, dur: 22, delay: 9 },
];

export function AuroraBackground({ showRadialGradient = true }) {
  const reduce = useReducedMotion();

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      {/* 顶部聚光灯（Spotlight）：微妙的蓝色光晕 */}
      <div
        className="absolute left-1/2 top-0 h-[64vmax] w-[92vmax] -translate-x-1/2 -translate-y-1/3 blur-3xl"
        style={{
          background:
            'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(59,130,246,0.22) 0%, rgba(34,211,238,0.10) 45%, transparent 75%)',
        }}
      />

      {BLOBS.map((b, i) => (
        <motion.div
          key={i}
          className="absolute h-[56vmax] w-[56vmax] rounded-full blur-3xl will-change-transform"
          style={{
            left: b.left,
            top: b.top,
            background: `radial-gradient(circle at center, ${b.color}30 0%, ${b.color}12 42%, transparent 70%)`,
          }}
          animate={
            reduce
              ? { x: 0, y: 0, scale: b.scale }
              : {
                  x: [0, 70, -50, 0],
                  y: [0, -50, 36, 0],
                  scale: [b.scale, b.scale * 1.08, b.scale * 0.95, b.scale],
                }
          }
          transition={{ duration: b.dur, delay: b.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {showRadialGradient && (
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 120% 70% at 50% -10%, rgba(5,5,16,0) 0%, #050510 74%)',
          }}
        />
      )}
    </div>
  );
}
