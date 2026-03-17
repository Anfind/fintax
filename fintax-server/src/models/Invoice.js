const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
  {
    company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    type: { type: String, enum: ['sale', 'purchase'], required: true, index: true },
    invoiceNumber: { type: String, required: true },
    invoiceSymbol: { type: String, default: '' },
    invoiceTemplate: { type: Number, default: 1 },
    invoiceDate: { type: Date, required: true, index: true },
    sellerSignDate: { type: Date, default: null },
    cqtSignDate: { type: Date, default: null },
    mccqt: { type: String, default: '' },
    currency: { type: String, default: 'VND' },
    exchangeRate: { type: Number, default: 1 },
    seller: {
      name: { type: String, default: '' },
      taxCode: { type: String, default: '' },
      address: { type: String, default: '' },
    },
    buyer: {
      name: { type: String, default: '' },
      taxCode: { type: String, default: '' },
      address: { type: String, default: '' },
    },
    subtotal: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    fees: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['new', 'replaced', 'adjusted', 'cancelled'],
      default: 'new',
      index: true,
    },
    checkResult: {
      type: String,
      enum: ['approved', 'rejected', 'pending'],
      default: 'approved',
    },
    paymentMethod: { type: String, default: '' },
    lookupCode: { type: String, default: '' },
    rawCrawlerId: { type: String, default: null },
    syncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Compound indexes for common queries
invoiceSchema.index({ company_id: 1, invoiceDate: -1 });
invoiceSchema.index({ company_id: 1, type: 1, invoiceDate: -1 });
invoiceSchema.index({ 'seller.taxCode': 1 });
invoiceSchema.index({ 'buyer.taxCode': 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
