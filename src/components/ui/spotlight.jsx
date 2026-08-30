import { useRef } from 'react';
import { motion, useMotionTemplate, useMotionValue } from 'framer-motion';
import { cn } from '../../lib/cn.js';

// 光标跟随光晕（Aceternity Spotlight）：悬停时在卡片上跟随鼠标显示径向光斑
export function Spotlight({ className, children, color = 'rgba(56, 189, 248, 0.14)' }) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  function onMouseMove(e) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set(e.clientX - rect.left);
    y.set(e.clientY - rect.top);
  }

  const background = useMotionTemplate`radial-gradient(260px circle at ${x}px ${y}px, ${color}, transparent 72%)`;

  return (
    <div ref={ref} onMouseMove={onMouseMove} className={cn('group relative overflow-hidden', className)}>
      <motion.div className="pointer-events-none absolute inset-0" style={{ background }} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
