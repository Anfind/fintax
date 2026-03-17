const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema(
  {
    company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    type: {
      type: String,
      enum: ['revenue', 'expense', 'revenue_forecast', 'expense_anomaly', 'churn'],
      required: true,
    },
    predictions: { type: mongoose.Schema.Types.Mixed, default: [] },
    stats: { type: mongoose.Schema.Types.Mixed, default: {} },
    parameters: { type: mongoose.Schema.Types.Mixed, default: {} },
    results: { type: mongoose.Schema.Types.Mixed, default: {} },
    generatedAt: { type: Date, default: Date.now },
    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Prediction', predictionSchema);
