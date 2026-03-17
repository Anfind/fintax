import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { InvoiceStatusData } from '@/services/analytics.service';

interface Props {
  data: InvoiceStatusData[];
  loading?: boolean;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  new: { label: 'Mới', color: '#3b82f6' },
  replaced: { label: 'Thay thế', color: '#f59e0b' },
  adjusted: { label: 'Điều chỉnh', color: '#f97316' },
  cancelled: { label: 'Đã hủy', color: '#ef4444' },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="glass-card p-3 !rounded-lg shadow-xl border border-white/10">
      <p className="text-sm font-bold text-white">{d.label}</p>
      <p className="text-xs text-slate-400 mt-1">{d.count} hóa đơn</p>
    </div>
  );
};

export default function InvoiceStatusChart({ data, loading }: Props) {
  if (loading) return <div className="h-[250px] shimmer rounded-2xl" />;

  // Aggregate by status
  const statusAgg: Record<string, number> = {};
  data.forEach((d) => {
    statusAgg[d.status] = (statusAgg[d.status] || 0) + d.count;
  });

  const chartData = Object.entries(statusAgg).map(([status, count]) => ({
    status,
    label: STATUS_MAP[status]?.label || status,
    count,
    color: STATUS_MAP[status]?.color || '#64748b',
  }));

  const total = chartData.reduce((s, d) => s + d.count, 0);

  if (total === 0) {
    return (
      <div className="card-gradient p-6 rounded-2xl border border-white/5 shadow-lg h-[250px] flex items-center justify-center">
        <p className="text-sm text-slate-500">Chưa có dữ liệu trạng thái</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.35 }}
      className="card-gradient p-6 rounded-2xl border border-white/5 shadow-lg"
    >
      <h3 className="text-lg font-bold text-white mb-1">Trạng thái hóa đơn</h3>
      <p className="text-sm text-slate-400 mb-4">Phân loại theo trạng thái</p>

      <div className="flex items-center gap-6">
        <div className="relative w-32 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={38}
                outerRadius={55}
                paddingAngle={2}
                dataKey="count"
                stroke="none"
                animationDuration={1200}
              >
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-white font-mono-numbers">{total}</span>
            <span className="text-[9px] text-slate-500 uppercase">Total</span>
          </div>
        </div>

        <div className="flex-1 space-y-2">
          {chartData.map((d, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                <span className="text-slate-300">{d.label}</span>
              </div>
              <span className="font-mono-numbers font-bold text-white">{d.count}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
