import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
  AreaChart,
} from 'recharts';
import type { StrategicMetricsData } from '@/services/analytics.service';
import { formatCompactVND } from '@/lib/utils';

interface Props {
  data: StrategicMetricsData | null;
  loading?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CurrencyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 !rounded-lg border border-white/10 min-w-[180px]">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 py-1">
          <span className="text-xs text-slate-300">{p.name}</span>
          <span className="text-xs font-bold text-white font-mono-numbers">{formatCompactVND(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PercentTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 !rounded-lg border border-white/10 min-w-[140px]">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-center justify-between gap-4 py-1">
        <span className="text-xs text-slate-300">Tỷ lệ</span>
        <span className="text-xs font-bold text-white font-mono-numbers">{Number(payload[0].value || 0).toFixed(2)}%</span>
      </div>
    </div>
  );
};

function concentrationLevel(hhi: number) {
  if (hhi >= 0.25) return 'Cao';
  if (hhi >= 0.15) return 'Trung bình';
  return 'Thấp';
}

export default function StrategicMetricsPanel({ data, loading }: Props) {
  if (loading) return <div className="h-[420px] shimmer rounded-2xl" />;
  if (!data) return null;

  const cashflow = data.cashflow.map((d) => ({
    period: d.period?.slice(5) || '',
    'Tiền vào': d.inflow || 0,
    'Tiền ra': d.outflow || 0,
    'Dòng tiền ròng': d.net || 0,
  }));

  const margin = data.marginTrend.map((d) => ({
    period: d.period?.slice(5) || '',
    'Biên lợi nhuận (%)': d.marginPct || 0,
  }));

  const taxBurden = data.taxBurdenTrend.map((d) => ({
    period: d.period?.slice(5) || '',
    'Gánh nặng thuế (%)': d.taxBurdenPct || 0,
  }));

  const hasSeriesData = cashflow.some((item) => item['Tiền vào'] > 0 || item['Tiền ra'] > 0 || item['Dòng tiền ròng'] !== 0);
  const hasCustomerData = data.customerConcentration.top.length > 0;
  const hasSupplierData = data.supplierDependency.top.length > 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="card-gradient p-6 rounded-2xl border border-white/5 shadow-lg"
    >
      <div className="flex items-end justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-white">Strategic Finance Signals</h3>
          <p className="text-xs text-slate-400 mt-1">Cashflow, margin, concentration, dependency và gánh nặng thuế</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {!hasSeriesData ? (
            <div className="rounded-xl border border-dashed border-white/20 bg-slate-900/20 p-8 text-center">
              <p className="text-sm text-slate-300">Chưa có dữ liệu chiến lược trong khoảng thời gian đã chọn.</p>
              <p className="text-xs text-slate-500 mt-2">Hãy mở rộng bộ lọc tháng hoặc đồng bộ thêm hóa đơn để xem xu hướng.</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-white/10 bg-slate-900/30 p-4">
                <h4 className="text-sm font-semibold text-slate-200 mb-3">Dòng tiền vào/ra/ròng theo tháng</h4>
                <ResponsiveContainer width="100%" height={230}>
                  <ComposedChart data={cashflow}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="period" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompactVND(v)} />
                    <Tooltip content={<CurrencyTooltip />} />
                    <Bar dataKey="Tiền vào" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Tiền ra" fill="#f97316" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="Dòng tiền ròng" stroke="#10b981" strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/10 bg-slate-900/30 p-4">
                  <h4 className="text-sm font-semibold text-slate-200 mb-3">Biên lợi nhuận (%)</h4>
                  <ResponsiveContainer width="100%" height={170}>
                    <AreaChart data={margin}>
                      <defs>
                        <linearGradient id="gradMargin" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="period" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                      <Tooltip content={<PercentTooltip />} />
                      <Area type="monotone" dataKey="Biên lợi nhuận (%)" stroke="#22c55e" fill="url(#gradMargin)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-900/30 p-4">
                  <h4 className="text-sm font-semibold text-slate-200 mb-3">Gánh nặng thuế ròng (%)</h4>
                  <ResponsiveContainer width="100%" height={170}>
                    <AreaChart data={taxBurden}>
                      <defs>
                        <linearGradient id="gradTaxBurden" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="period" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                      <Tooltip content={<PercentTooltip />} />
                      <Area type="monotone" dataKey="Gánh nặng thuế (%)" stroke="#f59e0b" fill="url(#gradTaxBurden)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-slate-900/30 p-4">
            <h4 className="text-sm font-semibold text-slate-200">Customer Concentration</h4>
            <p className="text-xs text-slate-400 mt-1">Top share: {data.customerConcentration.topSharePct.toFixed(1)}%</p>
            <p className="text-xs text-slate-400">HHI: {data.customerConcentration.hhi.toFixed(4)} ({concentrationLevel(data.customerConcentration.hhi)})</p>
            <div className="mt-3 space-y-2">
              {!hasCustomerData ? (
                <p className="text-xs text-slate-500">Chưa có dữ liệu khách hàng trong khoảng thời gian này.</p>
              ) : (
                data.customerConcentration.top.slice(0, 4).map((item) => (
                  <div key={`${item.taxCode}-${item.name}`}>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span className="truncate max-w-[70%]">{item.name || 'N/A'}</span>
                      <span>{item.sharePct.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
                      <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${Math.min(100, item.sharePct)}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-900/30 p-4">
            <h4 className="text-sm font-semibold text-slate-200">Supplier Dependency</h4>
            <p className="text-xs text-slate-400 mt-1">Top share: {data.supplierDependency.topSharePct.toFixed(1)}%</p>
            <p className="text-xs text-slate-400">HHI: {data.supplierDependency.hhi.toFixed(4)} ({concentrationLevel(data.supplierDependency.hhi)})</p>
            <div className="mt-3 space-y-2">
              {!hasSupplierData ? (
                <p className="text-xs text-slate-500">Chưa có dữ liệu nhà cung cấp trong khoảng thời gian này.</p>
              ) : (
                data.supplierDependency.top.slice(0, 4).map((item) => (
                  <div key={`${item.taxCode}-${item.name}`}>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span className="truncate max-w-[70%]">{item.name || 'N/A'}</span>
                      <span>{item.sharePct.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
                      <div className="h-1.5 rounded-full bg-fuchsia-500" style={{ width: `${Math.min(100, item.sharePct)}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
