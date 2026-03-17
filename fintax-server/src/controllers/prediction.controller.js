const {
  generateRevenueForecast,
  generateExpenseForecast,
  detectAnomalies,
  savePrediction,
} = require('../services/prediction.service');

// GET /api/predictions/revenue
exports.getRevenueForecast = async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ error: 'Chưa liên kết công ty' });

    const months = Math.min(parseInt(req.query.months) || 3, 12);
    const result = await generateRevenueForecast(companyId, months);

    if (result.error) return res.status(400).json({ error: result.error });

    // Save prediction for history
    savePrediction(companyId, 'revenue', result);

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

// GET /api/predictions/expense
exports.getExpenseForecast = async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ error: 'Chưa liên kết công ty' });

    const months = Math.min(parseInt(req.query.months) || 3, 12);
    const result = await generateExpenseForecast(companyId, months);

    if (result.error) return res.status(400).json({ error: result.error });

    savePrediction(companyId, 'expense', result);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

// GET /api/predictions/anomalies
exports.getAnomalies = async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ error: 'Chưa liên kết công ty' });

    const result = await detectAnomalies(companyId);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

// GET /api/predictions/summary
exports.getPredictionSummary = async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ error: 'Chưa liên kết công ty' });

    const [revenue, expense, anomalies] = await Promise.all([
      generateRevenueForecast(companyId, 3).catch(() => null),
      generateExpenseForecast(companyId, 3).catch(() => null),
      detectAnomalies(companyId).catch(() => ({ anomalies: [] })),
    ]);

    res.json({
      data: {
        revenue: revenue?.error ? null : revenue,
        expense: expense?.error ? null : expense,
        anomalies: anomalies.anomalies || [],
        hasEnoughData: !revenue?.error && !expense?.error,
      },
    });
  } catch (error) {
    next(error);
  }
};
