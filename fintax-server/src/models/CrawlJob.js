const mongoose = require('mongoose');

const crawlJobSchema = new mongoose.Schema(
  {
    company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ['sale', 'purchase', 'both'], default: 'both' },
    processType: { type: String, enum: ['tongquat', 'chitiet'], default: 'chitiet' },
    dateRange: {
      start: String,
      end: String,
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      default: 'pending',
    },
    progress: { type: Number, default: 0 },
    result: {
      invoicesFound: { type: Number, default: 0 },
      invoicesSaved: { type: Number, default: 0 },
      message: { type: String, default: '' },
    },
    error: { type: String, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CrawlJob', crawlJobSchema);
