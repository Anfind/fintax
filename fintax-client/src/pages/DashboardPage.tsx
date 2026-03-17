import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingDown, Wallet, FileText, Calendar, Download } from 'lucide-react';
import Header from '@/components/layout/Header';
import KPICard from '@/components/cards/KPICard';
import RevenueExpenseChart from '@/components/charts/RevenueExpenseChart';
import TaxPieChart from '@/components/charts/TaxPieChart';
import TopEntitiesChart from '@/components/charts/TopEntitiesChart';
import InvoiceStatusChart from '@/components/charts/InvoiceStatusChart';
import ForecastChart from '@/components/charts/ForecastChart';
import StrategicMetricsPanel from '@/components/charts/StrategicMetricsPanel';
import { analyticsService } from '@/services/analytics.service';
import type {
  OverviewData,
  TrendData,
  TopEntity,
  TaxDistribution,
  InvoiceStatusData,
  StrategicMetricsData,
} from '@/services/analytics.service';

function formatMonthInput(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getInitialDateRange() {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth() - 11, 1);
  return { from: formatMonthInput(from), to: formatMonthInput(to) };
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [partialError, setPartialError] = useState<string | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [trend, setTrend] = useState<TrendData[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopEntity[]>([]);
  const [topSuppliers, setTopSuppliers] = useState<TopEntity[]>([]);
  const [taxDist, setTaxDist] = useState<TaxDistribution[]>([]);
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatusData[]>([]);
  const [strategic, setStrategic] = useState<StrategicMetricsData | null>(null);
  const [dateRange, setDateRange] = useState(getInitialDateRange);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setPartialError(null);
    try {
      const normalized = dateRange.from <= dateRange.to
        ? dateRange
        : { from: dateRange.to, to: dateRange.from };
      const params = { from: normalized.from, to: normalized.to };

      const [ov, tr, tc, ts, td, is_, sm] = await Promise.allSettled([
        analyticsService.getOverview(params),
        analyticsService.getRevenueTrend(params),
        analyticsService.getTopCustomers({ ...params, limit: 5 }),
        analyticsService.getTopSuppliers({ ...params, limit: 5 }),
        analyticsService.getTaxDistribution(params),
        analyticsService.getInvoiceStatus(params),
        analyticsService.getStrategicMetrics({ ...params, limit: 5 }),
      ]);

      if (ov.status === 'fulfilled') setOverview(ov.value.data);
      else setOverview(null);

      if (tr.status === 'fulfilled') setTrend(tr.value.data.data || []);
      else setTrend([]);

      if (tc.status === 'fulfilled') setTopCustomers(tc.value.data.data || []);
      else setTopCustomers([]);

      if (ts.status === 'fulfilled') setTopSuppliers(ts.value.data.data || []);
      else setTopSuppliers([]);

      if (td.status === 'fulfilled') setTaxDist(td.value.data.data || []);
      else setTaxDist([]);

      if (is_.status === 'fulfilled') setInvoiceStatus(is_.value.data.data || []);
      else setInvoiceStatus([]);

      if (sm.status === 'fulfilled') setStrategic(sm.value.data.data || null);
      else setStrategic(null);

      const failedCount = [ov, tr, tc, ts, td, is_, sm].filter((r) => r.status === 'rejected').length;
      if (failedCount > 0) {
        setPartialError(`Một số dữ liệu dashboard chưa tải được (${failedCount}/7 endpoint). Đang hiển thị phần dữ liệu còn lại.`);
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setPartialError('Không thể tải dashboard. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <>
      <Header
        title="Dashboard Overview"
        subtitle="Theo dõi sức khỏe tài chính doanh nghiệp theo thời gian thực"
      />

      <div className="p-6 md:p-8 space-y-8">
        {partialError && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {partialError}
          </div>
        )}

        {/* Top Bar: Title + Actions */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Tổng quan tài chính</h1>
            <p className="text-slate-400 mt-1 text-sm">
              Dữ liệu từ {dateRange.from} đến {dateRange.to}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Date Range Selector */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300">
              <Calendar size={16} className="text-slate-400" />
              <input
                type="month"
                value={dateRange.from}
                onChange={(e) => setDateRange((p) => ({ ...p, from: e.target.value }))}
                className="bg-transparent border-none text-sm text-white focus:outline-none w-32"
              />
              <span className="text-slate-500">→</span>
              <input
                type="month"
                value={dateRange.to}
                onChange={(e) => setDateRange((p) => ({ ...p, to: e.target.value }))}
                className="bg-transparent border-none text-sm text-white focus:outline-none w-32"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-500/50">
              <Download size={16} />
              Xuất báo cáo
            </button>
          </div>
        </motion.div>

        {/* KPI Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            title="Tổng Doanh Thu"
            value={overview?.revenue.total ?? 0}
            growth={overview?.revenue.growth ?? 0}
            icon={<DollarSign size={22} />}
            color="blue"
            index={0}
          />
          <KPICard
            title="Tổng Chi Phí"
            value={overview?.expense.total ?? 0}
            growth={overview?.expense.growth ?? 0}
            icon={<TrendingDown size={22} />}
            color="rose"
            index={1}
          />
          <KPICard
            title="Lợi Nhuận Gộp"
            value={overview?.profit.total ?? 0}
            growth={overview?.profit.growth ?? 0}
            icon={<Wallet size={22} />}
            color="emerald"
            index={2}
          />
          <KPICard
            title="Tổng Hóa Đơn"
            value={overview?.invoiceCount ?? 0}
            growth={0}
            icon={<FileText size={22} />}
            color="amber"
            isCurrency={false}
            index={3}
          />
        </section>

        {/* Main Charts Row */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RevenueExpenseChart data={trend} loading={loading} />
          </div>
          <TaxPieChart data={taxDist} loading={loading} />
        </section>

        {/* Bottom Row */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <TopEntitiesChart
            data={topCustomers}
            title="Top 5 Khách hàng"
            type="customer"
            loading={loading}
          />
          <TopEntitiesChart
            data={topSuppliers}
            title="Top 5 Nhà cung cấp"
            type="supplier"
            loading={loading}
          />
          <InvoiceStatusChart data={invoiceStatus} loading={loading} />
        </section>

        {/* Forecast Section — Full Width */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ForecastChart />
        </section>

        <StrategicMetricsPanel data={strategic} loading={loading} />
      </div>
    </>
  );
}
