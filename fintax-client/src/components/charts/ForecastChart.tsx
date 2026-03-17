import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, AreaChart, Area,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle,
  DollarSign, BarChart3, Target, Activity, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { predictionService, type ForecastResult, type Anomaly } from '@/services/prediction.service';
import { formatCompactVND } from '@/lib/utils';

interface ChartPoint {
  period: string;
  actual?: number;
  predicted?: number;
}

/* Custom Tooltip */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 !rounded-xl shadow-xl border border-white/10 min-w-[160px]">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any, i: number) => {
        if (p.value == null) return null;
        const name = p.dataKey === 'actual' ? 'Thực tế' : 'Dự báo';
        return (
          <div key={i} className="flex justify-between items-center gap-4 py-0.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              <span className="text-xs text-slate-300">{name}</span>
            </div>
            <span className="text-xs font-bold text-white">{formatCompactVND(p.value)}</span>
          </div>
        );
      })}
    </div>
  );
};

/* Stat Card */
function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  color: 'blue' | 'emerald' | 'amber' | 'rose';
}) {
  const colors = {
    blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/20 text-blue-400',
    emerald: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 text-emerald-400',
    amber: 'from-amber-500/10 to-amber-500/5 border-amber-500/20 text-amber-400',
    rose: 'from-rose-500/10 to-rose-500/5 border-rose-500/20 text-rose-400',
  };
  return (
    <div className={`rounded-xl bg-gradient-to-br ${colors[color]} border p-4`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-slate-400">{label}</span>
      </div>
      <p className="text-lg font-bold text-white">{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function ForecastChart() {
  const [revForecast, setRevForecast] = useState<ForecastResult | null>(null);
  const [expForecast, setExpForecast] = useState<ForecastResult | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await predictionService.getSummary();
        const data = res.data.data;
        if (data.revenue) setRevForecast(data.revenue);
        if (data.expense) setExpForecast(data.expense);
        setAnomalies(data.anomalies || []);
      } catch {
        setError('Chưa đủ dữ liệu');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="lg:col-span-2 space-y-6">
        <div className="h-[420px] shimmer rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 shimmer rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (error || !revForecast) {
    return (
      <div className="lg:col-span-2 card-gradient rounded-2xl border border-white/5 p-8 flex flex-col items-center justify-center min-h-[200px]">
        <Activity size={32} className="text-slate-600 mb-3" />
        <h3 className="text-base font-semibold text-white mb-1">Dự báo tài chính</h3>
        <p className="text-sm text-slate-500 text-center">{error || 'Cần tối thiểu 3 tháng dữ liệu để tạo dự báo.'}</p>
      </div>
    );
  }

  const revChartData: ChartPoint[] = [
    ...revForecast.historical.map((h) => ({ period: h.period, actual: h.actual })),
    ...revForecast.predictions.map((p) => ({ period: p.period, predicted: p.predicted })),
  ];

  const expChartData: ChartPoint[] = expForecast ? [
    ...expForecast.historical.map((h) => ({ period: h.period, actual: h.actual })),
    ...expForecast.predictions.map((p) => ({ period: p.period, predicted: p.predicted })),
  ] : [];

  const TrendIcon = revForecast.stats.trend === 'up' ? TrendingUp
    : revForecast.stats.trend === 'down' ? TrendingDown : Minus;

  const nextPredicted = revForecast.predictions[0]?.predicted ?? 0;
  const lastActual = revForecast.historical[revForecast.historical.length - 1]?.actual ?? 0;
  const predChange = lastActual > 0 ? ((nextPredicted - lastActual) / lastActual * 100).toFixed(1) : '0';

  const expNextPredicted = expForecast?.predictions[0]?.predicted ?? 0;
  const expLastActual = expForecast?.historical[expForecast.historical.length - 1]?.actual ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="lg:col-span-2 space-y-6"
    >
      {/* Revenue Forecast */}
      <div className="card-gradient rounded-2xl border border-white/5 shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-white">Dự báo doanh thu</h3>
            <p className="text-xs text-slate-400 mt-1">
              {revForecast.stats.dataMonths} tháng dữ liệu | Độ tin cậy: {revForecast.stats.confidence}% | R2: {revForecast.stats.r2}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-blue-500" /> Thực tế</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-amber-500" /> Dự báo</span>
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              revForecast.stats.trend === 'up' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : revForecast.stats.trend === 'down' ? 'bg-red-500/10 border-red-500/20 text-red-400'
                  : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
            }`}>
              <TrendIcon size={14} />
              {revForecast.stats.trend === 'up' ? 'Tăng trưởng' : revForecast.stats.trend === 'down' ? 'Giảm' : 'Ổn định'}
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={revChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="period" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatCompactVND(v)} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="actual" fill="#3b82f6" radius={[4, 4, 0, 0]} fillOpacity={0.9} />
            <Line
              dataKey="predicted"
              stroke="#f59e0b"
              strokeWidth={2.5}
              strokeDasharray="8 4"
              dot={{ fill: '#f59e0b', r: 5, stroke: '#020617', strokeWidth: 2 }}
              activeDot={{ r: 7, fill: '#f59e0b', stroke: '#020617', strokeWidth: 3 }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>

        <div className="mt-4 flex flex-wrap gap-3">
          {revForecast.predictions.map((p, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/15">
              <Target size={12} className="text-amber-400" />
              <span className="text-xs font-medium text-amber-300">{p.period}</span>
              <span className="text-xs font-bold text-white">{formatCompactVND(p.predicted)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<DollarSign size={16} />}
          label="TB/tháng"
          value={formatCompactVND(revForecast.stats.avgMonthly)}
          sub={`Slope: ${revForecast.stats.slope > 0 ? '+' : ''}${formatCompactVND(revForecast.stats.slope)}/tháng`}
          color="blue"
        />
        <StatCard
          icon={<ArrowUpRight size={16} />}
          label="Dự báo tháng tới"
          value={formatCompactVND(nextPredicted)}
          sub={`${Number(predChange) >= 0 ? '+' : ''}${predChange}% so với tháng trước`}
          color="emerald"
        />
        <StatCard
          icon={<ArrowDownRight size={16} />}
          label="Dự báo chi phí tới"
          value={formatCompactVND(expNextPredicted)}
          sub={expLastActual ? `Tháng trước: ${formatCompactVND(expLastActual)}` : undefined}
          color="rose"
        />
        <StatCard
          icon={<AlertTriangle size={16} />}
          label="Bất thường"
          value={`${anomalies.length}`}
          sub={anomalies.length > 0 ? `${anomalies.filter(a => a.severity === 'high').length} mức cao` : 'Không phát hiện'}
          color="amber"
        />
      </div>

      {/* Bottom Row: Expense Forecast + Anomalies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {expForecast && (
          <div className="card-gradient rounded-2xl border border-white/5 shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Dự báo chi phí</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  R2: {expForecast.stats.r2} | Độ tin cậy: {expForecast.stats.confidence}%
                </p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                expForecast.stats.trend === 'up' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}>
                {expForecast.stats.trend === 'up' ? 'Tăng' : 'Giảm'}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={expChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradExpForecast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatCompactVND(v)} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="actual" stroke="#f43f5e" strokeWidth={2} fill="url(#gradExpForecast)" dot={false} />
                <Line dataKey="predicted" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 3" dot={{ fill: '#f59e0b', r: 4 }} connectNulls={false} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-3 flex flex-wrap gap-2">
              {expForecast.predictions.map((p, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-500/10 border border-rose-500/15 text-[11px]">
                  <BarChart3 size={10} className="text-rose-400" />
                  <span className="text-rose-300">{p.period}</span>
                  <span className="font-bold text-white">{formatCompactVND(p.predicted)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Anomaly Alerts */}
        <div className={`card-gradient rounded-2xl border border-white/5 shadow-lg p-6 ${!expForecast ? 'lg:col-span-2' : ''}`}>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-amber-400" />
            <h3 className="text-base font-bold text-white">Phát hiện bất thường</h3>
          </div>
          {anomalies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                <Activity size={20} className="text-emerald-400" />
              </div>
              <p className="text-sm text-slate-300 font-medium">Hệ thống ổn định</p>
              <p className="text-xs text-slate-500 mt-1">Không phát hiện biến động bất thường trong dữ liệu</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {anomalies.map((a, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${
                    a.severity === 'high'
                      ? 'bg-red-500/10 border-red-500/20'
                      : 'bg-amber-500/10 border-amber-500/20'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${a.severity === 'high' ? 'bg-red-400' : 'bg-amber-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${a.severity === 'high' ? 'text-red-400' : 'text-amber-400'}`}>
                        {a.period}
                      </span>
                      <span className="text-[10px] text-slate-500">z = {a.zScore}</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {a.type === 'sale' ? 'Doanh thu' : 'Chi phí'}{' '}
                      {a.direction === 'spike' ? 'tăng đột biến' : 'giảm bất thường'}
                      <span className="text-slate-500"> | {formatCompactVND(a.amount)} (TB: {formatCompactVND(a.mean)})</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}