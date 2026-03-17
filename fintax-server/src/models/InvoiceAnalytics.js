const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema(
  {
    company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    period: { type: String, required: true },        // YYYY-MM
    periodType: { type: String, enum: ['monthly', 'quarterly', 'yearly'], default: 'monthly' },
    sales: {
      totalRevenue: { type: Number, default: 0 },
      totalTax: { type: Number, default: 0 },
      invoiceCount: { type: Number, default: 0 },
      avgInvoiceValue: { type: Number, default: 0 },
      topCustomers: [{ name: String, taxCode: String, amount: Number }],
      byTaxRate: { type: Map, of: { count: Number, amount: Number } },
      byStatus: { type: Map, of: Number },
    },
    purchases: {
      totalExpense: { type: Number, default: 0 },
      totalTax: { type: Number, default: 0 },
      invoiceCount: { type: Number, default: 0 },
      avgInvoiceValue: { type: Number, default: 0 },
      topSuppliers: [{ name: String, taxCode: String, amount: Number }],
      byTaxRate: { type: Map, of: { count: Number, amount: Number } },
      byStatus: { type: Map, of: Number },
    },
    profitGross: { type: Number, default: 0 },
    growthRate: {
      revenueMoM: { type: Number, default: 0 },
      expenseMoM: { type: Number, default: 0 },
      profitMoM: { type: Number, default: 0 },
    },
    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

analyticsSchema.index({ company_id: 1, period: -1 });

module.exports = mongoose.model('InvoiceAnalytics', analyticsSchema);
