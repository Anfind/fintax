import React, { useRef, useState, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn, formatCompactVND } from '@/lib/utils';

// Simple count-up hook — no external dependency
function useCountUp(target: number, duration = 2000, enabled = true) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let rafId = 0;
    if (target === 0) {
      // Schedule reset on next frame to avoid synchronous setState in effect.
      rafId = requestAnimationFrame(() => setValue(0));
      return () => cancelAnimationFrame(rafId);
    }
    let startTime: number | null = null;
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration, enabled]);
  return value;
}

interface KPICardProps {
  title: string;
  value: number;
  growth: number;
  icon: React.ReactNode;
  color: 'blue' | 'rose' | 'emerald' | 'amber' | 'indigo' | 'purple';
  prefix?: string;
  suffix?: string;
  isCurrency?: boolean;
  index?: number;
}

const colorMap = {
  blue: {
    iconBg: 'bg-blue-500/10',
    iconText: 'text-blue-400',
    hoverText: 'group-hover:text-blue-400',
    glowBg: 'bg-blue-500/10 group-hover:bg-blue-500/20',
    shadow: 'hover:shadow-blue-500/5',
  },
  rose: {
    iconBg: 'bg-rose-500/10',
    iconText: 'text-rose-400',
    hoverText: 'group-hover:text-rose-400',
    glowBg: 'bg-rose-500/10 group-hover:bg-rose-500/20',
    shadow: 'hover:shadow-rose-500/5',
  },
  emerald: {
    iconBg: 'bg-emerald-500/10',
    iconText: 'text-emerald-400',
    hoverText: 'group-hover:text-emerald-400',
    glowBg: 'bg-emerald-500/10 group-hover:bg-emerald-500/20',
    shadow: 'hover:shadow-emerald-500/5',
  },
  amber: {
    iconBg: 'bg-amber-500/10',
    iconText: 'text-amber-400',
    hoverText: 'group-hover:text-amber-400',
    glowBg: 'bg-amber-500/10 group-hover:bg-amber-500/20',
    shadow: 'hover:shadow-amber-500/5',
  },
  indigo: {
    iconBg: 'bg-indigo-500/10',
    iconText: 'text-indigo-400',
    hoverText: 'group-hover:text-indigo-400',
    glowBg: 'bg-indigo-500/10 group-hover:bg-indigo-500/20',
    shadow: 'hover:shadow-indigo-500/5',
  },
  purple: {
    iconBg: 'bg-purple-500/10',
    iconText: 'text-purple-400',
    hoverText: 'group-hover:text-purple-400',
    glowBg: 'bg-purple-500/10 group-hover:bg-purple-500/20',
    shadow: 'hover:shadow-purple-500/5',
  },
};

export default function KPICard({
  title,
  value,
  growth,
  icon,
  color,
  isCurrency = true,
  index = 0,
}: KPICardProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const c = colorMap[color];

  const animated = useCountUp(value, 2000, inView);

  const TrendIcon = growth > 0 ? TrendingUp : growth < 0 ? TrendingDown : Minus;
  const trendBadge = growth > 0 ? 'badge-emerald' : growth < 0 ? 'badge-rose' : 'text-slate-400 bg-slate-500/10 border border-slate-500/20';

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        'card-gradient p-6 rounded-2xl border border-white/5 shadow-lg card-hover-lift group cursor-default relative overflow-hidden',
        c.shadow
      )}
    >
      {/* Glow orb */}
      <div className={cn('absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl transition-all', c.glowBg)} />

      {/* Header */}
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={cn('p-3 rounded-xl transition-colors', c.iconBg, 'group-hover:scale-110 transition-transform duration-300')}>
          <span className={c.iconText}>{icon}</span>
        </div>
        <span className={cn('flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full', trendBadge)}>
          <TrendIcon size={14} />
          {growth > 0 ? '+' : ''}{growth}%
        </span>
      </div>

      {/* Value */}
      <p className="text-sm font-medium text-slate-400">{title}</p>
      <h3 className={cn('text-3xl font-bold text-white mt-2 tracking-tight font-mono-numbers transition-colors', c.hoverText)}>
        {inView
          ? isCurrency
            ? formatCompactVND(animated)
            : animated.toLocaleString('vi-VN')
          : '—'}
      </h3>
    </motion.div>
  );
}
