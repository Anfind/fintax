import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { TrendData } from '@/services/analytics.service';
import { formatCompactVND } from '@/lib/utils';

interface Props {
  data: TrendData[];
  loading?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-4 !rounded-xl shadow-xl border border-white/10 min-w-[180px]">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex justify-between items-center gap-4 py-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color, boxShadow: `0 0 8px ${p.color}` }} />
            <span className="text-sm text-slate-300">{p.name}</span>
          </div>
          <span className="font-mono-numbers text-sm font-bold text-white">{formatCompactVND(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function RevenueExpenseChart({ data, loading }: Props) {
  if (loading) {
    return <div className="h-[350px] shimmer rounded-2xl" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="card-gradient p-6 rounded-2xl border border-white/5 shadow-lg h-[350px] flex items-center justify-center">
        <p className="text-sm text-slate-500">Chưa có dữ liệu doanh thu</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: d.period.slice(5), // MM from YYYY-MM
    'Doanh thu': d.revenue,
    'Chi phí': d.expense,
    'Lợi nhuận': d.profit,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="card-gradient p-6 rounded-2xl border border-white/5 shadow-lg"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-white">Doanh thu vs Chi phí</h3>
          <p className="text-xs text-slate-400 mt-1">So sánh theo tháng</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2 text-xs font-medium text-slate-300">
            <span className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" /> Doanh thu
          </span>
          <span className="flex items-center gap-2 text-xs font-medium text-slate-300">
            <span className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" /> Chi phí
          </span>
          <span className="flex items-center gap-2 text-xs font-medium text-slate-300">
            <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" /> Lợi nhuận
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompactVND(v)} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="Doanh thu" stroke="#3b82f6" strokeWidth={3} fill="url(#gradRevenue)" dot={false} activeDot={{ r: 6, fill: '#3b82f6', stroke: '#020617', strokeWidth: 3 }} />
          <Area type="monotone" dataKey="Chi phí" stroke="#f43f5e" strokeWidth={2} fill="url(#gradExpense)" dot={false} activeDot={{ r: 5, fill: '#f43f5e', stroke: '#020617', strokeWidth: 3 }} strokeDasharray="6 3" />
          <Area type="monotone" dataKey="Lợi nhuận" stroke="#10b981" strokeWidth={2} fill="url(#gradProfit)" dot={false} activeDot={{ r: 5, fill: '#10b981', stroke: '#020617', strokeWidth: 3 }} />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
