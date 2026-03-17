import { motion } from 'framer-motion';
import type { TopEntity } from '@/services/analytics.service';
import { formatCompactVND } from '@/lib/utils';

interface Props {
  data: TopEntity[];
  title: string;
  type: 'customer' | 'supplier';
  loading?: boolean;
}

export default function TopEntitiesChart({ data, title, type, loading }: Props) {
  if (loading) return <div className="h-[350px] shimmer rounded-2xl" />;

  const maxAmount = data.length > 0 ? data[0].totalAmount : 1;
  const gradientFrom = type === 'customer' ? 'from-blue-600' : 'from-purple-600';
  const gradientTo = type === 'customer' ? 'to-cyan-400' : 'to-fuchsia-400';
  const hoverColor = type === 'customer' ? 'group-hover:text-blue-400' : 'group-hover:text-purple-400';
  const glowColor = type === 'customer' ? '#3b82f6' : '#9333ea';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className="card-gradient p-6 rounded-2xl border border-white/5 shadow-lg hover:border-white/10 transition-all"
    >
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <button className="text-xs font-mono font-medium text-blue-400 hover:text-blue-300 hover:underline transition-colors">
          XEM TẤT CẢ
        </button>
      </div>

      <div className="space-y-5">
        {data.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-8">Chưa có dữ liệu</p>
        )}
        {data.map((entity, i) => {
          const pct = (entity.totalAmount / maxAmount) * 100;
          return (
            <motion.div
              key={entity.taxCode || i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.5 + i * 0.08 }}
              className="group cursor-default"
            >
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-slate-200 truncate max-w-[60%]" title={entity.name}>
                  {entity.name || 'N/A'}
                </span>
                <span className={`font-mono-numbers text-slate-400 transition-colors ${hoverColor}`}>
                  {formatCompactVND(entity.totalAmount)}
                </span>
              </div>
              <div className="w-full bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 1, delay: 0.6 + i * 0.1, ease: 'easeOut' }}
                  className={`bg-gradient-to-r ${gradientFrom} ${gradientTo} h-1.5 rounded-full`}
                  style={{
                    opacity: 1 - i * 0.12,
                    boxShadow: i === 0 ? `0 0 10px ${glowColor}` : 'none',
                  }}
                />
              </div>
              <div className="flex gap-3 mt-1">
                <span className="text-[11px] text-slate-500">{entity.invoiceCount} hóa đơn</span>
                <span className="text-[11px] text-slate-500">TB: {formatCompactVND(entity.avgAmount)}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
