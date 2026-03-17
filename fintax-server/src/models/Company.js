const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, trim: true },
    taxCode: { type: String, required: true, unique: true, trim: true },
    address: { type: String, default: '' },
    industry: { type: String, default: '' },
    crawlerPassword: { type: String, default: null }, // encrypted
    telegramGroupId: { type: String, default: null },
    telegramBotToken: { type: String, default: null },
    settings: {
      autoCrawlEnabled: { type: Boolean, default: false },
      crawlSchedule: { type: String, default: '0 6 * * 1' },
      alertThresholds: {
        revenueDropPercent: { type: Number, default: 20 },
        expenseSpikePercent: { type: Number, default: 30 },
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Company', companySchema);
