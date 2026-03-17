import api from './api';

export interface OverviewData {
  revenue: { total: number; tax: number; count: number; avg: number; growth: number };
  expense: { total: number; tax: number; count: number; avg: number; growth: number };
  profit: { total: number; growth: number };
  invoiceCount: number;
}

export interface TrendData {
  period: string;
  revenue: number;
  expense: number;
  profit: number;
  revenueCount: number;
  expenseCount: number;
}

export interface TopEntity {
  name: string;
  taxCode: string;
  totalAmount: number;
  invoiceCount: number;
  avgAmount: number;
  lastDate: string;
}

export interface TaxDistribution {
  taxRate: number;
  totalTax: number;
  totalPreTax: number;
  count: number;
}

export interface InvoiceStatusData {
  status: string;
  type: string;
  count: number;
  totalAmount: number;
}

export interface StrategicSeriesPoint {
  period: string;
  inflow?: number;
  outflow?: number;
  net?: number;
  marginPct?: number;
  revenue?: number;
  profit?: number;
  outputTax?: number;
  inputTax?: number;
  netTax?: number;
  taxBurdenPct?: number;
}

export interface StrategicTopItem {
  name: string;
  taxCode: string;
  totalAmount: number;
  sharePct: number;
}

export interface StrategicConcentration {
  totalAmount: number;
  topSharePct: number;
  hhi: number;
  top: StrategicTopItem[];
}

export interface StrategicMetricsData {
  cashflow: StrategicSeriesPoint[];
  marginTrend: StrategicSeriesPoint[];
  taxBurdenTrend: StrategicSeriesPoint[];
  customerConcentration: StrategicConcentration;
  supplierDependency: StrategicConcentration;
}

export const analyticsService = {
  getOverview: (params?: { from?: string; to?: string }) =>
    api.get<OverviewData>('/analytics/overview', { params }),

  getRevenueTrend: (params?: { from?: string; to?: string }) =>
    api.get<{ data: TrendData[] }>('/analytics/revenue-trend', { params }),

  getTopCustomers: (params?: { from?: string; to?: string; limit?: number }) =>
    api.get<{ data: TopEntity[] }>('/analytics/top-customers', { params }),

  getTopSuppliers: (params?: { from?: string; to?: string; limit?: number }) =>
    api.get<{ data: TopEntity[] }>('/analytics/top-suppliers', { params }),

  getTaxDistribution: (params?: { from?: string; to?: string }) =>
    api.get<{ data: TaxDistribution[] }>('/analytics/tax-distribution', { params }),

  getInvoiceStatus: (params?: { from?: string; to?: string }) =>
    api.get<{ data: InvoiceStatusData[] }>('/analytics/invoice-status', { params }),

  getStrategicMetrics: (params?: { from?: string; to?: string; limit?: number }) =>
    api.get<{ data: StrategicMetricsData }>('/analytics/strategic-metrics', { params }),
};
