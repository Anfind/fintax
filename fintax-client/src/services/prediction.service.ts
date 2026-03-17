import api from './api';

export interface PredictionPoint {
  period: string;
  predicted: number;
  trend?: number;
  month?: number;
  year?: number;
}

export interface HistoricalPoint {
  period: string;
  actual: number;
  invoiceCount?: number;
}

export interface ForecastResult {
  historical: HistoricalPoint[];
  predictions: PredictionPoint[];
  stats: {
    r2: number;
    slope: number;
    intercept: number;
    avgMonthly: number;
    trend: 'up' | 'down' | 'stable';
    confidence: number;
    dataMonths: number;
  };
}

export interface Anomaly {
  period: string;
  type: 'sale' | 'purchase';
  amount: number;
  mean: number;
  zScore: number;
  severity: 'high' | 'medium';
  direction: 'spike' | 'drop';
}

export interface PredictionSummary {
  revenue: ForecastResult | null;
  expense: ForecastResult | null;
  anomalies: Anomaly[];
  hasEnoughData: boolean;
}

export const predictionService = {
  getRevenueForecast: (months = 3) =>
    api.get<{ data: ForecastResult }>(`/predictions/revenue?months=${months}`),

  getExpenseForecast: (months = 3) =>
    api.get<{ data: ForecastResult }>(`/predictions/expense?months=${months}`),

  getAnomalies: () =>
    api.get<{ data: { anomalies: Anomaly[]; dataMonths: number } }>('/predictions/anomalies'),

  getSummary: () =>
    api.get<{ data: PredictionSummary }>('/predictions/summary'),
};
