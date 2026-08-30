import { cn } from '../../lib/cn.js';

// Aceternity Bento Grid：非对称卡片网格容器
export function BentoGrid({ className, children }) {
  return <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4', className)}>{children}</div>;
}

// 单个 Bento 卡片项
export function BentoGridItem({ className, children }) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02] transition-colors duration-300 hover:border-white/15 hover:bg-white/[0.04]',
        className,
      )}
    >
      {children}
    </div>
  );
}
