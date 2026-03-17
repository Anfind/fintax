const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema(
  {
    invoice_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    materialCode: { type: String, default: '' },
    productName: { type: String, default: '' },
    unit: { type: String, default: '' },
    quantity: { type: Number, default: 0 },
    unitPrice: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    preTaxAmount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    nature: { type: String, default: '' },
    batchNumber: { type: String, default: null },
    expiryDate: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InvoiceItem', invoiceItemSchema);
