import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Aceternity UI 标准的 cn 工具：合并条件类名并消解冲突（tailwind-merge 兼容 Tailwind v4）
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
