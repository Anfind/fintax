const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const Company = require('../models/Company');
const { getCrawlerDb } = require('../config/db');
const { parseVNDate } = require('../utils/dateUtils');

/**
 * Map Vietnamese invoice status to English
 */
const mapStatus = (str) => {
  if (!str) return 'new';
  const s = str.toLowerCase();
  if (s.includes('thay thế')) return 'replaced';
  if (s.includes('điều chỉnh')) return 'adjusted';
  if (s.includes('hủy') || s.includes('xóa')) return 'cancelled';
  return 'new';
};

const mapCheckResult = (str) => {
  if (!str) return 'pending';
  const s = str.toLowerCase();
  if (s.includes('cấp mã') || s.includes('hợp lệ')) return 'approved';
  if (s.includes('từ chối') || s.includes('không hợp lệ')) return 'rejected';
  return 'pending';
};

const parseTaxRate = (str) => {
  if (!str && str !== 0) return 0;
  if (typeof str === 'number') return str;
  return parseFloat(String(str).replace('%', '')) || 0;
};

/**
 * Build a unique key for an invoice from raw crawler data.
 * Multiple raw rows with the same key belong to the same invoice (multi-item).
 */
const getInvoiceKey = (raw) => {
  const symbol = (raw['Ký hiệu hóa  đơn'] || raw['Ký hiệu hóa đơn'] || '').trim();
  const number = String(raw['Số hóa đơn'] || '').trim();
  const date = (raw['Ngày lập hóa đơn'] || '').trim();
  return `${symbol}|${number}|${date}`;
};

/**
 * Sync invoices from fintax_crawler -> fintax_web
 * Groups raw rows into proper invoices (1 invoice = N line items)
 * @param {Function} [onProgress] - Optional callback (current, total) for progress
 */
const syncInvoices = async (companyTaxCode, onProgress) => {
  const crawlerDb = getCrawlerDb();
  if (!crawlerDb) throw new Error('Crawler DB not connected');

  const company = await Company.findOne({ taxCode: companyTaxCode });
  if (!company) throw new Error(`Company not found: ${companyTaxCode}`);

  let totalSynced = 0;
  let totalSkipped = 0;
  let totalItems = 0;

  // Load all raw docs
  const salesDocs = await crawlerDb.collection('HoaDonBanRa').find({ username: companyTaxCode }).toArray();
  const purchaseDocs = await crawlerDb.collection('HoaDonMuaVao').find({ username: companyTaxCode }).toArray();

  // Group and sync sales
  const salesResult = await syncGroupedInvoices(salesDocs, 'sale', company._id);
  totalSynced += salesResult.synced;
  totalSkipped += salesResult.skipped;
  totalItems += salesResult.items;

  if (onProgress) onProgress(salesDocs.length, salesDocs.length + purchaseDocs.length);

  // Group and sync purchases
  const purchaseResult = await syncGroupedInvoices(purchaseDocs, 'purchase', company._id);
  totalSynced += purchaseResult.synced;
  totalSkipped += purchaseResult.skipped;
  totalItems += purchaseResult.items;

  if (onProgress) onProgress(salesDocs.length + purchaseDocs.length, salesDocs.length + purchaseDocs.length);

  return {
    totalSynced,
    totalSkipped,
    totalItems,
    totalRawDocs: salesDocs.length + purchaseDocs.length,
  };
};

/**
 * Group raw docs by invoice key, then create 1 Invoice + N InvoiceItems per group
 */
const syncGroupedInvoices = async (rawDocs, type, companyId) => {
  let synced = 0, skipped = 0, items = 0;

  // Group by invoice key (symbol + number + date)
  const groups = new Map();
  for (const doc of rawDocs) {
    const key = getInvoiceKey(doc);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(doc);
  }

  for (const [, docs] of groups) {
    const raw = docs[0]; // Use first row for header fields
    const rawIds = docs.map((d) => d._id.toString());

    // Dedup: skip if we already synced any raw doc from this group
    const existing = await Invoice.findOne({ rawCrawlerId: { $in: rawIds } });
    if (existing) {
      skipped++;
      continue;
    }

    const invoiceDate = parseVNDate(raw['Ngày lập hóa đơn']);
    if (!invoiceDate) {
      skipped++;
      continue;
    }

    // For multi-item invoices, subtotal/taxAmount per item, totalAmount is invoice-level
    const invoiceTotalAmount = raw['Tổng tiền thanh toán'] || 0;
    const invoiceDiscount = raw['Tổng tiền CKTM'] || 0;
    const invoiceFees = raw['Tổng tiền phí'] || 0;

    // Sum line-item amounts for subtotal & tax
    let sumPreTax = 0, sumTax = 0;
    for (const d of docs) {
      sumPreTax += d['Thành tiền chưa thuế'] || 0;
      sumTax += d['Tiền thuế'] || 0;
    }

    const invoice = await Invoice.create({
      company_id: companyId,
      type,
      invoiceNumber: String(raw['Số hóa đơn'] || '').trim(),
      invoiceSymbol: (raw['Ký hiệu hóa  đơn'] || raw['Ký hiệu hóa đơn'] || '').trim(),
      invoiceTemplate: raw['Mẫu số HD'] || 1,
      invoiceDate,
      sellerSignDate: parseVNDate(raw['Ngày người bán ký số']),
      cqtSignDate: parseVNDate(raw['Ngày CQT ký số']),
      mccqt: raw['MCCQT'] || '',
      currency: raw['Đơn vị tiền tệ'] || 'VND',
      exchangeRate: raw['Tỷ giá'] || 1,
      seller: {
        name: raw['Tên người bán'] || '',
        taxCode: raw['MST người bán'] || '',
        address: raw['Địa chỉ người bán'] || '',
      },
      buyer: {
        name: raw['Tên người mua'] || '',
        taxCode: raw['MST người mua'] || '',
        address: raw['Địa chỉ người mua'] || '',
      },
      subtotal: sumPreTax,
      taxAmount: sumTax,
      discount: invoiceDiscount,
      fees: invoiceFees,
      totalAmount: invoiceTotalAmount,
      status: mapStatus(raw['Trạng thái hóa đơn']),
      checkResult: mapCheckResult(raw['Kết quả kiểm tra hóa đơn']),
      paymentMethod: (raw['Hình  thức thanh toán'] || raw['Hình thức thanh toán'] || '').trim(),
      lookupCode: raw['Mã tra cứu'] || '',
      rawCrawlerId: rawIds[0],
      syncedAt: new Date(),
    });

    // Create InvoiceItem for each raw row
    for (const doc of docs) {
      if (doc['Tên hàng hóa, dịch vụ']) {
        await InvoiceItem.create({
          invoice_id: invoice._id,
          company_id: companyId,
          materialCode: doc['Mã VT'] || '',
          productName: doc['Tên hàng hóa, dịch vụ'] || '',
          unit: doc['Đơn vị tính'] || '',
          quantity: doc['Số lượng'] || 0,
          unitPrice: doc['Đơn giá'] || 0,
          discount: doc['Chiết khấu'] || 0,
          taxRate: parseTaxRate(doc['Thuế suất']),
          preTaxAmount: doc['Thành tiền chưa thuế'] || 0,
          taxAmount: doc['Tiền thuế'] || 0,
          nature: doc['Tính chất'] || '',
          batchNumber: doc['Số lô '] || null,
          expiryDate: doc['Hạn dùng '] ? parseVNDate(doc['Hạn dùng ']) : null,
        });
        items++;
      }
    }

    synced++;
  }

  return { synced, skipped, items };
};

module.exports = { syncInvoices };
