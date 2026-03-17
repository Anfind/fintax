/**
 * Prediction Service — Simple forecasting based on invoice data.
 * Uses linear regression + seasonal adjustment.
 * No external ML library needed.
 */
const Invoice = require('../models/Invoice');
const Prediction = require('../models/Prediction');

// ─── Simple Linear Regression ───────────────────────────
function linearRegression(xs, ys) {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] || 0, r2: 0 };

  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sumX2 = xs.reduce((a, x) => a + x * x, 0);
  const sumY2 = ys.reduce((a, y) => a + y * y, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // R² coefficient
  const meanY = sumY / n;
  const ssRes = ys.reduce((a, y, i) => a + (y - (slope * xs[i] + intercept)) ** 2, 0);
  const ssTot = ys.reduce((a, y) => a + (y - meanY) ** 2, 0);
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { slope, intercept, r2 };
}

// ─── Moving Average ─────────────────────────────────────
function movingAverage(data, window = 3) {
  return data.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

// ─── Generate Monthly Revenue Forecast ──────────────────
async function generateRevenueForecast(companyId, forecastMonths = 3) {
  // Get last 12 months of revenue
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const monthlyData = await Invoice.aggregate([
    {
      $match: {
        company_id: companyId,
        type: 'sale',
        invoiceDate: { $gte: twelveMonthsAgo },
      },
    },
    {
      $group: {
        _id: { y: { $year: '$invoiceDate' }, m: { $month: '$invoiceDate' } },
        total: { $sum: '$totalAmount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.y': 1, '_id.m': 1 } },
  ]);

  if (monthlyData.length < 3) {
    return { error: 'Cần ít nhất 3 tháng dữ liệu để dự đoán.' };
  }

  const xs = monthlyData.map((_, i) => i);
  const ys = monthlyData.map((d) => d.total);

  // Linear regression for trend
  const { slope, intercept, r2 } = linearRegression(xs, ys);

  // Smoothed values
  const smoothed = movingAverage(ys);

  // Calculate seasonal factors (ratio of actual to smoothed average)
  const avgSmoothed = smoothed.reduce((a, b) => a + b, 0) / smoothed.length;
  const seasonalFactors = smoothed.map((s) => (avgSmoothed ? s / avgSmoothed : 1));

  // Generate predictions
  const predictions = [];
  const lastMonthData = monthlyData[monthlyData.length - 1];
  let predMonth = lastMonthData._id.m;
  let predYear = lastMonthData._id.y;

  for (let i = 0; i < forecastMonths; i++) {
    predMonth++;
    if (predMonth > 12) {
      predMonth = 1;
      predYear++;
    }

    const x = xs.length + i;
    const trendValue = slope * x + intercept;
    // Apply seasonal adjustment from same relative position
    const seasonIdx = (xs.length + i) % seasonalFactors.length;
    const seasonFactor = seasonalFactors[seasonIdx] || 1;
    const predicted = Math.max(0, trendValue * seasonFactor);

    predictions.push({
      period: `${predMonth}/${predYear}`,
      month: predMonth,
      year: predYear,
      predicted: Math.round(predicted),
      trend: Math.round(trendValue),
    });
  }

  // Confidence level based on R² and data quantity
  const dataQuality = Math.min(1, monthlyData.length / 12);
  const confidence = Math.round((r2 * 0.6 + dataQuality * 0.4) * 100);

  return {
    historical: monthlyData.map((d) => ({
      period: `${d._id.m}/${d._id.y}`,
      actual: Math.round(d.total),
      invoiceCount: d.count,
    })),
    predictions,
    stats: {
      r2: Math.round(r2 * 1000) / 1000,
      slope: Math.round(slope),
      intercept: Math.round(intercept),
      avgMonthly: Math.round(ys.reduce((a, b) => a + b, 0) / ys.length),
      trend: slope > 0 ? 'up' : slope < 0 ? 'down' : 'stable',
      confidence,
      dataMonths: monthlyData.length,
    },
  };
}

// ─── Generate Expense Forecast ──────────────────────────
async function generateExpenseForecast(companyId, forecastMonths = 3) {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const monthlyData = await Invoice.aggregate([
    {
      $match: {
        company_id: companyId,
        type: 'purchase',
        invoiceDate: { $gte: twelveMonthsAgo },
      },
    },
    {
      $group: {
        _id: { y: { $year: '$invoiceDate' }, m: { $month: '$invoiceDate' } },
        total: { $sum: '$totalAmount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.y': 1, '_id.m': 1 } },
  ]);

  if (monthlyData.length < 3) {
    return { error: 'Cần ít nhất 3 tháng dữ liệu chi phí để dự đoán.' };
  }

  const xs = monthlyData.map((_, i) => i);
  const ys = monthlyData.map((d) => d.total);
  const { slope, intercept, r2 } = linearRegression(xs, ys);
  const smoothed = movingAverage(ys);

  const lastMonthData = monthlyData[monthlyData.length - 1];
  let predMonth = lastMonthData._id.m;
  let predYear = lastMonthData._id.y;
  const predictions = [];

  for (let i = 0; i < forecastMonths; i++) {
    predMonth++;
    if (predMonth > 12) { predMonth = 1; predYear++; }
    const predicted = Math.max(0, slope * (xs.length + i) + intercept);
    predictions.push({
      period: `${predMonth}/${predYear}`,
      predicted: Math.round(predicted),
    });
  }

  return {
    historical: monthlyData.map((d) => ({
      period: `${d._id.m}/${d._id.y}`,
      actual: Math.round(d.total),
    })),
    predictions,
    stats: { r2: Math.round(r2 * 1000) / 1000, trend: slope > 0 ? 'up' : 'down' },
  };
}

// ─── Anomaly Detection ──────────────────────────────────
async function detectAnomalies(companyId) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const monthlyData = await Invoice.aggregate([
    {
      $match: {
        company_id: companyId,
        invoiceDate: { $gte: sixMonthsAgo },
      },
    },
    {
      $group: {
        _id: { y: { $year: '$invoiceDate' }, m: { $month: '$invoiceDate' }, type: '$type' },
        total: { $sum: '$totalAmount' },
        count: { $sum: 1 },
        maxSingle: { $max: '$totalAmount' },
      },
    },
    { $sort: { '_id.y': 1, '_id.m': 1 } },
  ]);

  // Calculate mean and stddev per type
  const byType = {};
  for (const d of monthlyData) {
    const key = d._id.type;
    if (!byType[key]) byType[key] = [];
    byType[key].push(d.total);
  }

  const anomalies = [];
  for (const [type, values] of Object.entries(byType)) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stddev = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);

    for (const d of monthlyData.filter((m) => m._id.type === type)) {
      const zScore = stddev ? (d.total - mean) / stddev : 0;
      if (Math.abs(zScore) > 1.5) {
        anomalies.push({
          period: `${d._id.m}/${d._id.y}`,
          type,
          amount: d.total,
          mean: Math.round(mean),
          zScore: Math.round(zScore * 100) / 100,
          severity: Math.abs(zScore) > 2 ? 'high' : 'medium',
          direction: zScore > 0 ? 'spike' : 'drop',
        });
      }
    }
  }

  return { anomalies, dataMonths: monthlyData.length };
}

// ─── Save Prediction (for historical tracking) ─────────
async function savePrediction(companyId, type, data) {
  try {
    await Prediction.create({
      company_id: companyId,
      type,
      predictions: data.predictions,
      stats: data.stats,
      generatedAt: new Date(),
    });
  } catch (err) {
    console.error('Failed to save prediction:', err.message);
  }
}

module.exports = {
  generateRevenueForecast,
  generateExpenseForecast,
  detectAnomalies,
  savePrediction,
  linearRegression,
};
