import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { TaxDistribution } from '@/services/analytics.service';
import { formatCompactVND } from '@/lib/utils';

interface Props {
  data: TaxDistribution[];
  loading?: boolean;
}

const COLORS = ['#3b82f6', '#a855f7', '#06b6d4', '#f59e0b', '#64748b'];
const GLOW_COLORS = ['#3b82f6', '#a855f7', '#06b6d4', '#f59e0b', '#64748b'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="glass-card p-3 !rounded-lg shadow-xl border border-white/10">
      <p className="text-sm font-bold text-white">VAT {d.taxRate}%</p>
      <p className="text-xs text-slate-400 mt-1">Thuế: {formatCompactVND(d.totalTax)}</p>
      <p className="text-xs text-slate-400">Trước thuế: {formatCompactVND(d.totalPreTax)}</p>
      <p className="text-xs text-slate-400">Số lượng: {d.count}</p>
    </div>
  );
};

export default function TaxPieChart({ data, loading }: Props) {
  if (loading) return <div className="h-[350px] shimmer rounded-2xl" />;

  if (!data || data.length === 0) {
    return (
      <div className="card-gradient p-6 rounded-2xl border border-white/5 shadow-lg h-[350px] flex items-center justify-center">
        <p className="text-sm text-slate-500">Chưa có dữ liệu thuế</p>
      </div>
    );
  }

  const totalTax = data.reduce((s, d) => s + d.totalTax, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="card-gradient p-6 rounded-2xl border border-white/5 shadow-lg flex flex-col"
    >
      <h3 className="text-lg font-bold text-white mb-1">Phân bổ thuế</h3>
      <p className="text-sm text-slate-400 mb-4">Theo thuế suất</p>

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative w-48 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="totalTax"
                stroke="none"
                animationBegin={0}
                animationDuration={1500}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-white font-mono-numbers">
              {formatCompactVND(totalTax)}
            </span>
            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-1">
              Total Tax
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="w-full mt-6 space-y-2">
          {data.map((d, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-slate-800/50 transition-colors cursor-default"
            >
              <div className="flex items-center gap-3">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ background: COLORS[i], boxShadow: `0 0 8px ${GLOW_COLORS[i]}` }}
                />
                <span className="text-slate-300">VAT {d.taxRate}%</span>
              </div>
              <span className="font-bold font-mono-numbers text-white">
                {totalTax > 0 ? `${((d.totalTax / totalTax) * 100).toFixed(0)}%` : '0%'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
