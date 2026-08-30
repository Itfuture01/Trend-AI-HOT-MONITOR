import { motion, useReducedMotion } from 'framer-motion';

// 极光背景（Aceternity 风格）：固定全屏、多层彩色光斑缓慢漂移，尊重 prefers-reduced-motion
// 配色：翡翠绿 → 青 → 青绿（科技感，去掉蓝紫）
const BLOBS = [
  { color: '#22c55e', left: '-12%', top: '-14%', scale: 1.1, dur: 20, delay: 0 },
  { color: '#22d3ee', left: '26%', top: '8%', scale: 1.25, dur: 26, delay: 3 },
  { color: '#2dd4bf', left: '58%', top: '-8%', scale: 1.0, dur: 30, delay: 6 },
  { color: '#5eead4', left: '82%', top: '12%', scale: 1.15, dur: 22, delay: 9 },
];

export function AuroraBackground({ showRadialGradient = true }) {
  const reduce = useReducedMotion();

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
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
            background:
              'radial-gradient(ellipse 120% 70% at 50% -10%, rgba(15,23,42,0) 0%, #0f172a 74%)',
          }}
        />
      )}
    </div>
  );
}
