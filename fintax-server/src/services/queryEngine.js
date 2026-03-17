/**
 * Shared smart query engine — used by both Web Chat and Telegram Bot.
 * Interprets Vietnamese natural language → MongoDB aggregation.
 * Enhanced with RAG (Groq) when available, falls back to rule-based.
 *
 * Features:
 *   - 30+ intent detection patterns (Vietnamese + English)
 *   - Smart date extraction (tháng, quý, năm, tuần, hôm nay, so sánh)
 *   - Entity extraction (tên KH, NCC, số hóa đơn, sản phẩm)
 *   - Dynamic deep context for unknown intents
 *   - Comparison & growth analysis
 *   - Invoice detail lookup by number/customer/product
 */
const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const ragService = require('./rag.service');

// ═══════════════════════════════════════════════════════════
// ─── INTENT DETECTION (30+ patterns) ──────────────────────
// ═══════════════════════════════════════════════════════════
const detectIntent = (msg) => {
  const lower = msg.toLowerCase();

  // ── Comparison / So sánh ──
  if (/so sánh|compare|đối chiếu|versus|vs\b/.test(lower)) {
    if (/khách|customer|người mua/.test(lower)) return 'compare_customers';
    if (/nhà cung|supplier|người bán/.test(lower)) return 'compare_suppliers';
    if (/tháng|thang|month/.test(lower)) return 'compare_months';
    if (/quý|quarter/.test(lower)) return 'compare_quarters';
    return 'compare_months';
  }

  // ── Growth / Tăng trưởng ──
  if (/tăng trưởng|growth|tăng|giảm|biến động|thay đổi|change/.test(lower)) {
    if (/chi phí|expense|mua vào/.test(lower)) return 'expense_growth';
    return 'revenue_growth';
  }

  // ── Anomaly / Bất thường ──
  if (/bất thường|anomal|cao bất|lớn bất|đột biến|spike|unusual/.test(lower)) return 'anomaly_detect';

  // ── Revenue / Doanh thu ──
  if (/doanh thu|revenue|bán ra|ban ra|doanh số|turnover|sales/.test(lower)) {
    if (/top|cao nhất|lớn nhất|nhiều nhất|biggest|highest/.test(lower)) return 'top_revenue';
    if (/thấp nhất|ít nhất|lowest|smallest/.test(lower)) return 'bottom_revenue';
    if (/xu hướng|trend|biểu đồ|chart|graph/.test(lower)) return 'revenue_trend';
    if (/trung bình|average|avg|tb/.test(lower)) return 'revenue_avg';
    if (/theo ngày|daily|hàng ngày/.test(lower)) return 'revenue_daily';
    if (/theo quý|quarterly|quý/.test(lower)) return 'revenue_quarterly';
    return 'revenue_summary';
  }

  // ── Expense / Chi phí ──
  if (/chi phí|expense|mua vào|mua vao|cost|chi tiêu|thanh toán cho/.test(lower)) {
    if (/top|cao nhất|lớn nhất|nhiều nhất/.test(lower)) return 'top_expense';
    if (/thấp nhất|ít nhất/.test(lower)) return 'bottom_expense';
    if (/xu hướng|trend|biểu đồ|chart/.test(lower)) return 'expense_trend';
    if (/trung bình|average|avg|tb/.test(lower)) return 'expense_avg';
    return 'expense_summary';
  }

  // ── Profit / Lợi nhuận ──
  if (/lợi nhuận|profit|lãi|biên lợi|margin/.test(lower)) {
    if (/xu hướng|trend|biểu đồ|chart/.test(lower)) return 'profit_trend';
    if (/theo tháng|monthly|hàng tháng/.test(lower)) return 'profit_trend';
    return 'profit_summary';
  }

  // ── Customer / Khách hàng ──
  if (/khách hàng|customer|người mua|buyer/.test(lower)) {
    if (/chi tiết|detail|thông tin|info/.test(lower)) return 'customer_detail';
    if (/mới|new|lần đầu|first/.test(lower)) return 'new_customers';
    if (/trung thành|loyal|thường xuyên|frequent|hay mua/.test(lower)) return 'loyal_customers';
    if (/bottom|thấp nhất|ít nhất/.test(lower)) return 'bottom_customers';
    return 'top_customers';
  }

  // ── Supplier / Nhà cung cấp ──
  if (/nhà cung cấp|supplier|người bán|vendor|ncc/.test(lower)) {
    if (/chi tiết|detail|thông tin|info/.test(lower)) return 'supplier_detail';
    return 'top_suppliers';
  }

  // ── Product / Sản phẩm / Dịch vụ ──
  if (/sản phẩm|product|hàng hóa|dịch vụ|service|vật tư|mặt hàng|item/.test(lower)) {
    if (/top|bán chạy|nhiều nhất|best/.test(lower)) return 'top_products';
    return 'product_summary';
  }

  // ── Tax / Thuế ──
  if (/thuế|tax|vat|thuế suất/.test(lower)) {
    if (/phải nộp|payable|cần nộp|tổng thuế/.test(lower)) return 'tax_payable';
    if (/khấu trừ|deduct|input|đầu vào/.test(lower)) return 'tax_deductible';
    return 'tax_summary';
  }

  // ── Invoice / Hóa đơn ──
  if (/hóa đơn|hoá đơn|invoice|hd\b/.test(lower)) {
    if (/số\s*\d+|number|mã|lookup|tra cứu/.test(lower)) return 'invoice_lookup';
    if (/gần đây|recent|mới nhất|latest|cuối|last/.test(lower)) return 'recent_invoices';
    if (/lớn nhất|cao nhất|biggest|largest/.test(lower)) return 'largest_invoices';
    if (/hủy|cancelled|thay thế|replaced|điều chỉnh|adjusted/.test(lower)) return 'special_invoices';
    if (/bao nhiêu|tổng|count|số lượng|đếm/.test(lower)) return 'invoice_count';
    return 'invoice_summary';
  }

  // ── Cash flow / Dòng tiền ──
  if (/dòng tiền|cash\s*flow|tiền vào|tiền ra|thu chi/.test(lower)) return 'cashflow';

  // ── Period analysis ──
  if (/tháng này|this month|hiện tại|current/.test(lower)) return 'current_month';
  if (/tháng trước|last month|tháng vừa rồi|tháng rồi/.test(lower)) return 'last_month';
  if (/quý này|this quarter|quarter/.test(lower)) return 'current_quarter';
  if (/năm nay|this year|cả năm/.test(lower)) return 'yearly_summary';

  // ── Overview / Report ──
  if (/tổng quan|overview|summary|báo cáo|report|tóm tắt|toàn bộ/.test(lower)) return 'overview';

  // ── Greetings / Help ──
  if (/^(hi|hello|xin chào|chào|hey)\s*[!.?]*$/i.test(lower.trim())) return 'greeting';
  if (/giúp|help|hướng dẫn|guide|làm gì|có thể|bạn biết/.test(lower)) return 'help';

  return 'unknown';
};

// ═══════════════════════════════════════════════════════════
// ─── SMART DATE EXTRACTION ────────────────────────────────
// ═══════════════════════════════════════════════════════════
const extractDateRange = (msg, anchorYear) => {
  const now = new Date();
  const defaultYear = anchorYear || now.getFullYear();
  const lower = msg.toLowerCase();

  // "hôm nay" / "today"
  if (/hôm nay|today|ngày hôm nay/.test(lower)) {
    const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const end = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59));
    return { $gte: start, $lte: end };
  }

  // "tuần này" / "this week"
  if (/tuần này|this week|tuần nay/.test(lower)) {
    const day = now.getDay() || 7;
    const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - day + 1));
    return { $gte: start, $lte: now };
  }

  // "tuần trước" / "last week"
  if (/tuần trước|last week|tuần rồi/.test(lower)) {
    const day = now.getDay() || 7;
    const thisMonday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - day + 1));
    const lastMonday = new Date(thisMonday); lastMonday.setDate(lastMonday.getDate() - 7);
    const lastSunday = new Date(thisMonday); lastSunday.setDate(lastSunday.getDate() - 1); lastSunday.setHours(23, 59, 59);
    return { $gte: lastMonday, $lte: lastSunday };
  }

  // "tháng này" / "this month"
  if (/tháng này|this month|tháng hiện tại/.test(lower)) {
    return { $gte: new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)), $lte: now };
  }

  // "tháng trước" / "last month"
  if (/tháng trước|last month|tháng rồi|tháng vừa/.test(lower)) {
    return {
      $gte: new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1)),
      $lte: new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)),
    };
  }

  // "quý 1/2/3/4" or "Q1/Q2/Q3/Q4"
  const quarterMatch = lower.match(/(?:quý|q)\s*(\d)(?:\s*[/\-]\s*(\d{4}))?/);
  if (quarterMatch) {
    const q = parseInt(quarterMatch[1]);
    const y = parseInt(quarterMatch[2]) || now.getFullYear();
    const startMonth = (q - 1) * 3;
    return {
      $gte: new Date(Date.UTC(y, startMonth, 1)),
      $lte: new Date(Date.UTC(y, startMonth + 3, 0, 23, 59, 59)),
    };
  }

  // "nửa đầu năm" / "6 tháng đầu" / "H1"
  if (/nửa đầu|6 tháng đầu|h1\b|first half/.test(lower)) {
    const y = lower.match(/(\d{4})/)?.[1] || defaultYear;
    return { $gte: new Date(Date.UTC(y, 0, 1)), $lte: new Date(Date.UTC(y, 5, 30, 23, 59, 59)) };
  }

  // "nửa cuối năm" / "6 tháng cuối" / "H2"
  if (/nửa cuối|6 tháng cuối|h2\b|second half/.test(lower)) {
    const y = lower.match(/(\d{4})/)?.[1] || defaultYear;
    return { $gte: new Date(Date.UTC(y, 6, 1)), $lte: new Date(Date.UTC(y, 11, 31, 23, 59, 59)) };
  }

  // "tháng X" hoặc "tháng X/YYYY" hoặc "tháng X năm YYYY"
  const monthMatch = lower.match(/tháng\s*(\d{1,2})(?:\s*[/\-]\s*(\d{4})|\s*năm\s*(\d{4}))?/);
  if (monthMatch) {
    const m = parseInt(monthMatch[1]);
    const y = parseInt(monthMatch[2] || monthMatch[3]) || defaultYear;
    return { $gte: new Date(Date.UTC(y, m - 1, 1)), $lte: new Date(Date.UTC(y, m, 0, 23, 59, 59)) };
  }

  // "năm YYYY"
  const yearMatch = lower.match(/năm\s*(\d{4})/);
  if (yearMatch) {
    const y = parseInt(yearMatch[1]);
    return { $gte: new Date(Date.UTC(y, 0, 1)), $lte: new Date(Date.UTC(y, 11, 31, 23, 59, 59)) };
  }

  // "N tháng gần đây / qua / trước"
  const recentMonths = lower.match(/(\d+)\s*tháng\s*(gần|qua|trước|vừa|last)/);
  if (recentMonths) {
    const n = parseInt(recentMonths[1]);
    return { $gte: new Date(Date.UTC(now.getFullYear(), now.getMonth() - n, 1)), $lte: now };
  }

  // "từ tháng X đến tháng Y"
  const rangeMatch = lower.match(/từ\s*tháng\s*(\d{1,2})(?:\s*[/\-]\s*(\d{4}))?\s*(?:đến|tới|->)\s*tháng\s*(\d{1,2})(?:\s*[/\-]\s*(\d{4}))?/);
  if (rangeMatch) {
    const m1 = parseInt(rangeMatch[1]), y1 = parseInt(rangeMatch[2]) || defaultYear;
    const m2 = parseInt(rangeMatch[3]), y2 = parseInt(rangeMatch[4]) || defaultYear;
    return {
      $gte: new Date(Date.UTC(y1, m1 - 1, 1)),
      $lte: new Date(Date.UTC(y2, m2, 0, 23, 59, 59)),
    };
  }

  // "cuối năm" / "các tháng cuối"
  if (/cuối năm|tháng cuối|quý 4|q4/.test(lower)) {
    const y = lower.match(/(\d{4})/)?.[1] || defaultYear;
    return { $gte: new Date(Date.UTC(y, 9, 1)), $lte: new Date(Date.UTC(y, 11, 31, 23, 59, 59)) };
  }

  // Default: YTD (Year to date)
  return { $gte: new Date(Date.UTC(now.getFullYear(), 0, 1)), $lte: now };
};

const hasExplicitDateRange = (msg) => {
  const lower = (msg || '').toLowerCase();
  return /hôm nay|today|ngày hôm nay|tuần này|this week|tuần trước|last week|tháng này|this month|tháng trước|last month|quý|\bq[1-4]\b|nửa đầu|h1\b|nửa cuối|h2\b|tháng\s*\d+|năm\s*\d{4}|\d+\s*tháng\s*(gần|qua|trước|vừa|last)|từ\s*tháng\s*\d+\s*(đến|tới|->)\s*tháng\s*\d+|cuối năm|q4/.test(lower);
};

const getSmartDefaultDateRange = async (companyId) => {
  const latest = await Invoice.findOne({ company_id: companyId })
    .sort({ invoiceDate: -1 })
    .select('invoiceDate')
    .lean();

  const anchor = latest?.invoiceDate ? new Date(latest.invoiceDate) : new Date();
  const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 11, 1));
  const end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0, 23, 59, 59));
  return { $gte: start, $lte: end };
};

// ═══════════════════════════════════════════════════════════
// ─── ENTITY EXTRACTION ────────────────────────────────────
// ═══════════════════════════════════════════════════════════
const extractEntities = (msg) => {
  const entities = {};

  // Invoice number: "hóa đơn số 153", "HĐ 153", "invoice #153"
  const invoiceNum = msg.match(/(?:hóa đơn|hoá đơn|hd|invoice)\s*(?:số|#|number)?\s*(\d+)/i);
  if (invoiceNum) entities.invoiceNumber = invoiceNum[1].trim();

  // Company/customer name in quotes: "của LILAMA", "từ LILAMA 10"
  const nameQuote = msg.match(/(?:của|từ|cho|khách|ncc|nhà cung)\s+["']?([A-ZÀ-Ỹ][A-ZÀ-Ỹa-zà-ỹ\s&.,0-9]{2,50})["']?/);
  if (nameQuote) entities.entityName = nameQuote[1].trim();

  // MST (tax code): 10-14 digits
  const taxCode = msg.match(/(?:mst|mã số thuế|tax\s*code)?\s*(\d{10,14})/i);
  if (taxCode) entities.taxCode = taxCode[1];

  // Top N: "top 10", "5 lớn nhất"
  const topN = msg.match(/top\s*(\d+)|(\d+)\s*(?:lớn nhất|cao nhất|nhiều nhất)/i);
  if (topN) entities.limit = parseInt(topN[1] || topN[2]);

  // Product name
  const productMatch = msg.match(/(?:sản phẩm|dịch vụ|hàng|mặt hàng|vật tư)\s+["']?([^"'\n]{3,60})["']?/i);
  if (productMatch) entities.productName = productMatch[1].trim();

  return entities;
};

// ═══════════════════════════════════════════════════════════
// ─── HELPERS ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════
const fmtVND = (n) => {
  if (!n && n !== 0) return '0 ₫';
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)} tỷ ₫`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)} triệu ₫`;
  return `${n.toLocaleString('vi-VN')} ₫`;
};

const NO_DATA_REGEX = /không có dữ liệu|chưa có dữ liệu|không tìm thấy|chưa có thông tin/i;
const NUMERIC_TOKEN_REGEX = /\d[\d.,]*/g;
const NO_DATA_FALLBACK_TEXT =
  '⚠️ Chưa có dữ liệu cho khoảng thời gian này.\n\n' +
  '💡 Gợi ý: Bạn có thể mở rộng khoảng thời gian hoặc đồng bộ thêm dữ liệu hóa đơn rồi thử lại.';

const hasNoDataSignal = (text) => NO_DATA_REGEX.test(String(text || ''));

const countNumericTokens = (text) => {
  const matches = String(text || '').match(NUMERIC_TOKEN_REGEX);
  return matches ? matches.length : 0;
};

const shouldFallbackFromRag = ({ structuredData, ragText }) => {
  const sourceText = String(structuredData || '');
  const generatedText = String(ragText || '');

  const sourceNoData = hasNoDataSignal(sourceText);
  const ragNoData = hasNoDataSignal(generatedText);

  if (sourceNoData) {
    // If source says no data but generated answer claims concrete figures, fallback.
    if (!ragNoData) return true;
    if (countNumericTokens(generatedText) > 4) return true;
  }

  const sourceNumbers = countNumericTokens(sourceText);
  const ragNumbers = countNumericTokens(generatedText);

  // High numeric density without source numeric evidence is likely hallucinated.
  if (sourceNumbers === 0 && ragNumbers >= 6 && !ragNoData) return true;

  return false;
};

const pctChange = (current, previous) => {
  if (!previous) return 'N/A';
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const arrow = pct > 0 ? '📈' : pct < 0 ? '📉' : '➡️';
  return `${arrow} ${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
};

// ═══════════════════════════════════════════════════════════
// ─── QUERY HANDLERS (30+) ─────────────────────────────────
// ═══════════════════════════════════════════════════════════
const queryHandlers = {

  // ── Revenue ───────────────────────────────────────────
  async revenue_summary(companyId, dateRange, entities) {
    const [current, monthlyBreakdown] = await Promise.all([
      Invoice.aggregate([
        { $match: { company_id: companyId, type: 'sale', invoiceDate: dateRange } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, subtotal: { $sum: '$subtotal' }, tax: { $sum: '$taxAmount' }, count: { $sum: 1 }, avg: { $avg: '$totalAmount' }, min: { $min: '$totalAmount' }, max: { $max: '$totalAmount' } } },
      ]),
      Invoice.aggregate([
        { $match: { company_id: companyId, type: 'sale', invoiceDate: dateRange } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } }, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);
    const d = current[0] || { total: 0, subtotal: 0, tax: 0, count: 0, avg: 0, min: 0, max: 0 };
    let text = `📊 **Tóm tắt doanh thu**\n\n` +
      `- Tổng doanh thu: **${fmtVND(d.total)}**\n` +
      `- Doanh thu chưa thuế: ${fmtVND(d.subtotal)}\n` +
      `- Thuế bán ra: ${fmtVND(d.tax)}\n` +
      `- Số hóa đơn: **${d.count}**\n` +
      `- Trung bình/HĐ: ${fmtVND(d.avg)}\n` +
      `- HĐ nhỏ nhất: ${fmtVND(d.min)} | Lớn nhất: ${fmtVND(d.max)}`;
    if (monthlyBreakdown.length > 1) {
      text += `\n\n**Chi tiết theo tháng:**\n`;
      monthlyBreakdown.forEach(m => { text += `  ${m._id}: ${fmtVND(m.total)} (${m.count} HĐ)\n`; });
    }
    return { text };
  },

  async revenue_trend(companyId, dateRange) {
    const result = await Invoice.aggregate([
      { $match: { company_id: companyId, type: 'sale', invoiceDate: dateRange } },
      { $group: { _id: { y: { $year: '$invoiceDate' }, m: { $month: '$invoiceDate' } }, total: { $sum: '$totalAmount' }, count: { $sum: 1 }, avg: { $avg: '$totalAmount' } } },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]);
    if (!result.length) return { text: 'Không có dữ liệu doanh thu trong khoảng thời gian này.' };
    const lines = result.map((r, i) => {
      const growth = i > 0 ? pctChange(r.total, result[i - 1].total) : '';
      return `  T${r._id.m}/${r._id.y}: ${fmtVND(r.total)} (${r.count} HĐ) ${growth}`;
    });
    const chartData = result.map(r => ({ period: `T${r._id.m}/${r._id.y}`, revenue: r.total, count: r.count }));
    return {
      text: `📈 **Xu hướng doanh thu theo tháng**\n\n${lines.join('\n')}`,
      chartData: { type: 'line', data: chartData, xKey: 'period', yKey: 'revenue', label: 'Doanh thu' },
    };
  },

  async revenue_quarterly(companyId, dateRange) {
    const result = await Invoice.aggregate([
      { $match: { company_id: companyId, type: 'sale', invoiceDate: dateRange } },
      { $group: { _id: { y: { $year: '$invoiceDate' }, q: { $ceil: { $divide: [{ $month: '$invoiceDate' }, 3] } } }, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { '_id.y': 1, '_id.q': 1 } },
    ]);
    if (!result.length) return { text: 'Không có dữ liệu doanh thu theo quý.' };
    const lines = result.map((r, i) => {
      const growth = i > 0 ? pctChange(r.total, result[i - 1].total) : '';
      return `  Q${r._id.q}/${r._id.y}: ${fmtVND(r.total)} (${r.count} HĐ) ${growth}`;
    });
    const chartData = result.map(r => ({ period: `Q${r._id.q}/${r._id.y}`, revenue: r.total }));
    return {
      text: `📊 **Doanh thu theo quý**\n\n${lines.join('\n')}`,
      chartData: { type: 'bar', data: chartData, xKey: 'period', yKey: 'revenue', label: 'Doanh thu quý' },
    };
  },

  async revenue_daily(companyId, dateRange) {
    const result = await Invoice.aggregate([
      { $match: { company_id: companyId, type: 'sale', invoiceDate: dateRange } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$invoiceDate' } }, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $limit: 31 },
    ]);
    if (!result.length) return { text: 'Không có dữ liệu doanh thu theo ngày.' };
    const lines = result.map(r => `  ${r._id}: ${fmtVND(r.total)} (${r.count} HĐ)`);
    return { text: `📅 **Doanh thu theo ngày**\n\n${lines.join('\n')}` };
  },

  async revenue_avg(companyId, dateRange) {
    const result = await Invoice.aggregate([
      { $match: { company_id: companyId, type: 'sale', invoiceDate: dateRange } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } }, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    if (!result.length) return { text: 'Không có dữ liệu.' };
    const totalAll = result.reduce((s, r) => s + r.total, 0);
    const avgMonth = totalAll / result.length;
    const avgInvoice = totalAll / result.reduce((s, r) => s + r.count, 0);
    return {
      text: `📊 **Doanh thu trung bình**\n\n` +
        `- TB/tháng: **${fmtVND(avgMonth)}**\n` +
        `- TB/hóa đơn: **${fmtVND(avgInvoice)}**\n` +
        `- Tháng cao nhất: ${fmtVND(Math.max(...result.map(r => r.total)))}\n` +
        `- Tháng thấp nhất: ${fmtVND(Math.min(...result.map(r => r.total)))}`,
    };
  },

  async revenue_growth(companyId, dateRange) {
    const result = await Invoice.aggregate([
      { $match: { company_id: companyId, type: 'sale', invoiceDate: dateRange } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } }, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    if (result.length < 2) return { text: 'Cần ít nhất 2 tháng dữ liệu để phân tích tăng trưởng.' };
    const lines = result.map((r, i) => {
      if (i === 0) return `  ${r._id}: ${fmtVND(r.total)} (khởi điểm)`;
      const prev = result[i - 1];
      return `  ${r._id}: ${fmtVND(r.total)} ${pctChange(r.total, prev.total)}`;
    });
    const overall = pctChange(result[result.length - 1].total, result[0].total);
    return { text: `📈 **Phân tích tăng trưởng doanh thu**\n\n${lines.join('\n')}\n\n**Tổng tăng trưởng: ${overall}**` };
  },

  async top_revenue(companyId, dateRange, entities) { return queryHandlers.top_customers(companyId, dateRange, entities); },
  async bottom_revenue(companyId, dateRange) {
    const result = await Invoice.aggregate([
      { $match: { company_id: companyId, type: 'sale', invoiceDate: dateRange } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } }, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { total: 1 } },
      { $limit: 5 },
    ]);
    if (!result.length) return { text: 'Không có dữ liệu.' };
    const lines = result.map((r, i) => `  ${i + 1}. ${r._id}: ${fmtVND(r.total)} (${r.count} HĐ)`);
    return { text: `📉 **Tháng doanh thu thấp nhất**\n\n${lines.join('\n')}` };
  },

  // ── Expense ───────────────────────────────────────────
  async expense_summary(companyId, dateRange) {
    const [current, monthlyBreakdown] = await Promise.all([
      Invoice.aggregate([
        { $match: { company_id: companyId, type: 'purchase', invoiceDate: dateRange } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, subtotal: { $sum: '$subtotal' }, tax: { $sum: '$taxAmount' }, count: { $sum: 1 }, avg: { $avg: '$totalAmount' }, min: { $min: '$totalAmount' }, max: { $max: '$totalAmount' } } },
      ]),
      Invoice.aggregate([
        { $match: { company_id: companyId, type: 'purchase', invoiceDate: dateRange } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } }, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);
    const d = current[0] || { total: 0, subtotal: 0, tax: 0, count: 0, avg: 0, min: 0, max: 0 };
    let text = `💸 **Tóm tắt chi phí**\n\n` +
      `- Tổng chi phí: **${fmtVND(d.total)}**\n` +
      `- Chi phí chưa thuế: ${fmtVND(d.subtotal)}\n` +
      `- Thuế mua vào: ${fmtVND(d.tax)}\n` +
      `- Số hóa đơn: **${d.count}**\n` +
      `- Trung bình/HĐ: ${fmtVND(d.avg)}\n` +
      `- HĐ nhỏ nhất: ${fmtVND(d.min)} | Lớn nhất: ${fmtVND(d.max)}`;
    if (monthlyBreakdown.length > 1) {
      text += `\n\n**Chi tiết theo tháng:**\n`;
      monthlyBreakdown.forEach(m => { text += `  ${m._id}: ${fmtVND(m.total)} (${m.count} HĐ)\n`; });
    }
    return { text };
  },

  async expense_trend(companyId, dateRange) {
    const result = await Invoice.aggregate([
      { $match: { company_id: companyId, type: 'purchase', invoiceDate: dateRange } },
      { $group: { _id: { y: { $year: '$invoiceDate' }, m: { $month: '$invoiceDate' } }, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]);
    if (!result.length) return { text: 'Không có dữ liệu chi phí.' };
    const lines = result.map((r, i) => {
      const growth = i > 0 ? pctChange(r.total, result[i - 1].total) : '';
      return `  T${r._id.m}/${r._id.y}: ${fmtVND(r.total)} (${r.count} HĐ) ${growth}`;
    });
    const chartData = result.map(r => ({ period: `T${r._id.m}/${r._id.y}`, expense: r.total }));
    return {
      text: `📉 **Xu hướng chi phí theo tháng**\n\n${lines.join('\n')}`,
      chartData: { type: 'line', data: chartData, xKey: 'period', yKey: 'expense', label: 'Chi phí' },
    };
  },

  async expense_avg(companyId, dateRange) {
    const result = await Invoice.aggregate([
      { $match: { company_id: companyId, type: 'purchase', invoiceDate: dateRange } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } }, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    if (!result.length) return { text: 'Không có dữ liệu.' };
    const totalAll = result.reduce((s, r) => s + r.total, 0);
    const avgMonth = totalAll / result.length;
    return { text: `💸 **Chi phí trung bình**\n- TB/tháng: **${fmtVND(avgMonth)}**\n- Tháng cao nhất: ${fmtVND(Math.max(...result.map(r => r.total)))}` };
  },

  async expense_growth(companyId, dateRange) {
    const result = await Invoice.aggregate([
      { $match: { company_id: companyId, type: 'purchase', invoiceDate: dateRange } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } }, total: { $sum: '$totalAmount' } } },
      { $sort: { _id: 1 } },
    ]);
    if (result.length < 2) return { text: 'Cần ít nhất 2 tháng dữ liệu để phân tích.' };
    const lines = result.map((r, i) => {
      if (i === 0) return `  ${r._id}: ${fmtVND(r.total)}`;
      return `  ${r._id}: ${fmtVND(r.total)} ${pctChange(r.total, result[i - 1].total)}`;
    });
    return { text: `📈 **Biến động chi phí**\n\n${lines.join('\n')}` };
  },

  async top_expense(companyId, dateRange, entities) { return queryHandlers.top_suppliers(companyId, dateRange, entities); },
  async bottom_expense(companyId, dateRange) {
    const result = await Invoice.aggregate([
      { $match: { company_id: companyId, type: 'purchase', invoiceDate: dateRange } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } }, total: { $sum: '$totalAmount' } } },
      { $sort: { total: 1 } }, { $limit: 5 },
    ]);
    if (!result.length) return { text: 'Không có dữ liệu.' };
    const lines = result.map((r, i) => `  ${i + 1}. ${r._id}: ${fmtVND(r.total)}`);
    return { text: `📉 **Tháng chi phí thấp nhất**\n\n${lines.join('\n')}` };
  },

  // ── Profit ────────────────────────────────────────────
  async profit_summary(companyId, dateRange) {
    const [salesArr, purchasesArr] = await Promise.all([
      Invoice.aggregate([
        { $match: { company_id: companyId, type: 'sale', invoiceDate: dateRange } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, subtotal: { $sum: '$subtotal' }, tax: { $sum: '$taxAmount' }, count: { $sum: 1 } } },
      ]),
      Invoice.aggregate([
        { $match: { company_id: companyId, type: 'purchase', invoiceDate: dateRange } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, subtotal: { $sum: '$subtotal' }, tax: { $sum: '$taxAmount' }, count: { $sum: 1 } } },
      ]),
    ]);
    const rev = salesArr[0] || { total: 0, subtotal: 0, tax: 0, count: 0 };
    const exp = purchasesArr[0] || { total: 0, subtotal: 0, tax: 0, count: 0 };
    const profit = rev.total - exp.total;
    const margin = rev.total > 0 ? ((profit / rev.total) * 100).toFixed(1) : 0;
    const taxPayable = Math.max(0, (rev.tax || 0) - (exp.tax || 0));
    return {
      text: `💰 **Phân tích lợi nhuận**\n\n` +
        `- Doanh thu: **${fmtVND(rev.total)}** (${rev.count} HĐ)\n` +
        `- Chi phí: **${fmtVND(exp.total)}** (${exp.count} HĐ)\n` +
        `- **Lợi nhuận gộp: ${fmtVND(profit)}**\n` +
        `- Biên lợi nhuận: **${margin}%**\n` +
        `- Thuế GTGT phải nộp (ước tính): ${fmtVND(taxPayable)}\n` +
        `  (Thuế bán ra ${fmtVND(rev.tax)} - Thuế mua vào ${fmtVND(exp.tax)})`,
    };
  },

  async profit_trend(companyId, dateRange) {
    const result = await Invoice.aggregate([
      { $match: { company_id: companyId, invoiceDate: dateRange } },
      { $group: { _id: { month: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } }, type: '$type' }, total: { $sum: '$totalAmount' } } },
      { $sort: { '_id.month': 1 } },
    ]);
    if (!result.length) return { text: 'Không có dữ liệu.' };
    const byMonth = {};
    result.forEach(r => {
      if (!byMonth[r._id.month]) byMonth[r._id.month] = { sale: 0, purchase: 0 };
      byMonth[r._id.month][r._id.type] = r.total;
    });
    const entries = Object.entries(byMonth).sort();
    const lines = entries.map(([m, v], i) => {
      const profit = v.sale - v.purchase;
      const growth = i > 0 ? pctChange(profit, Object.values(byMonth)[i - 1].sale - Object.values(byMonth)[i - 1].purchase) : '';
      return `  ${m}: DT ${fmtVND(v.sale)} - CP ${fmtVND(v.purchase)} = **LN ${fmtVND(profit)}** ${growth}`;
    });
    const chartData = entries.map(([m, v]) => ({ period: m, revenue: v.sale, expense: v.purchase, profit: v.sale - v.purchase }));
    return {
      text: `💰 **Xu hướng lợi nhuận theo tháng**\n\n${lines.join('\n')}`,
      chartData: { type: 'composed', data: chartData, xKey: 'period', yKey: 'profit', label: 'Doanh thu / Chi phí / Lợi nhuận' },
    };
  },

  // ── Customer ──────────────────────────────────────────
  async top_customers(companyId, dateRange, entities) {
    const limit = entities?.limit || 10;
    const result = await Invoice.aggregate([
      { $match: { company_id: companyId, type: 'sale', invoiceDate: dateRange } },
      { $group: { _id: { name: '$buyer.name', taxCode: '$buyer.taxCode' }, total: { $sum: '$totalAmount' }, count: { $sum: 1 }, avg: { $avg: '$totalAmount' }, last: { $max: '$invoiceDate' } } },
      { $sort: { total: -1 } },
      { $limit: limit },
    ]);
    if (!result.length) return { text: 'Chưa có dữ liệu khách hàng.' };
    const totalRevenue = result.reduce((s, r) => s + r.total, 0);
    const lines = result.map((r, i) => {
      const pct = ((r.total / totalRevenue) * 100).toFixed(1);
      return `  ${i + 1}. **${r._id.name}** (MST: ${r._id.taxCode || 'N/A'})\n     ${fmtVND(r.total)} | ${r.count} HĐ | TB: ${fmtVND(r.avg)} | ${pct}% tổng DT`;
    });
    const chartData = result.slice(0, 10).map(r => ({ label: (r._id.name || '').slice(0, 25), value: r.total }));
    return {
      text: `👥 **Top ${limit} Khách hàng**\n\n${lines.join('\n')}`,
      chartData: [
        { type: 'bar', data: chartData, xKey: 'label', yKey: 'value', label: 'Doanh thu theo KH' },
        { type: 'pie', data: chartData.slice(0, 6), xKey: 'label', yKey: 'value', label: 'Tỷ trọng KH' },
      ],
    };
  },

  async bottom_customers(companyId, dateRange) {
    const result = await Invoice.aggregate([
      { $match: { company_id: companyId, type: 'sale', invoiceDate: dateRange } },
      { $group: { _id: '$buyer.name', total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { total: 1 } }, { $limit: 5 },
    ]);
    if (!result.length) return { text: 'Không có dữ liệu.' };
    const lines = result.map((r, i) => `  ${i + 1}. **${r._id}**: ${fmtVND(r.total)} (${r.count} HĐ)`);
    return { text: `👥 **Khách hàng doanh thu thấp nhất**\n\n${lines.join('\n')}` };
  },

  async customer_detail(companyId, dateRange, entities) {
    const match = { company_id: companyId, type: 'sale', invoiceDate: dateRange };
    if (entities?.entityName) match['buyer.name'] = { $regex: entities.entityName, $options: 'i' };
    else if (entities?.taxCode) match['buyer.taxCode'] = entities.taxCode;
    else return { text: 'Vui lòng chỉ định tên hoặc MST khách hàng. VD: "Chi tiết khách hàng LILAMA"' };

    const [summary, invoices] = await Promise.all([
      Invoice.aggregate([
        { $match: match },
        { $group: { _id: { name: '$buyer.name', taxCode: '$buyer.taxCode' }, total: { $sum: '$totalAmount' }, tax: { $sum: '$taxAmount' }, count: { $sum: 1 }, avg: { $avg: '$totalAmount' }, first: { $min: '$invoiceDate' }, last: { $max: '$invoiceDate' } } },
      ]),
      Invoice.find(match).sort({ invoiceDate: -1 }).limit(10).select('invoiceNumber invoiceDate totalAmount').lean(),
    ]);
    if (!summary.length) return { text: `Không tìm thấy khách hàng "${entities.entityName || entities.taxCode}".` };
    const d = summary[0];
    let text = `👤 **Chi tiết khách hàng: ${d._id.name}**\n` +
      `MST: ${d._id.taxCode || 'N/A'}\n\n` +
      `- Tổng doanh thu: **${fmtVND(d.total)}**\n` +
      `- Thuế: ${fmtVND(d.tax)}\n- Số HĐ: ${d.count}\n- TB/HĐ: ${fmtVND(d.avg)}\n` +
      `- Giao dịch đầu: ${d.first?.toLocaleDateString('vi-VN') || 'N/A'}\n` +
      `- Giao dịch cuối: ${d.last?.toLocaleDateString('vi-VN') || 'N/A'}\n`;
    if (invoices.length) {
      text += `\n**10 hóa đơn gần nhất:**\n`;
      invoices.forEach(inv => { text += `  #${inv.invoiceNumber} - ${inv.invoiceDate?.toLocaleDateString('vi-VN')} - ${fmtVND(inv.totalAmount)}\n`; });
    }
    return { text };
  },

  async new_customers(companyId, dateRange) {
    const beforeRange = { $lt: dateRange.$gte };
    const [allCurrent, allBefore] = await Promise.all([
      Invoice.distinct('buyer.taxCode', { company_id: companyId, type: 'sale', invoiceDate: dateRange }),
      Invoice.distinct('buyer.taxCode', { company_id: companyId, type: 'sale', invoiceDate: beforeRange }),
    ]);
    const beforeSet = new Set(allBefore);
    const newTaxCodes = allCurrent.filter(tc => tc && !beforeSet.has(tc));
    if (!newTaxCodes.length) return { text: 'Không có khách hàng mới trong khoảng thời gian này.' };
    const details = await Invoice.aggregate([
      { $match: { company_id: companyId, type: 'sale', invoiceDate: dateRange, 'buyer.taxCode': { $in: newTaxCodes } } },
      { $group: { _id: { name: '$buyer.name', taxCode: '$buyer.taxCode' }, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);
    const lines = details.map((r, i) => `  ${i + 1}. **${r._id.name}** (MST: ${r._id.taxCode}): ${fmtVND(r.total)} - ${r.count} HĐ`);
    return { text: `🆕 **Khách hàng mới (${newTaxCodes.length})**\n\n${lines.join('\n')}` };
  },

  async loyal_customers(companyId, dateRange) {
    const result = await Invoice.aggregate([
      { $match: { company_id: companyId, type: 'sale', invoiceDate: dateRange } },
      { $group: { _id: '$buyer.name', total: { $sum: '$totalAmount' }, count: { $sum: 1 }, months: { $addToSet: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } } } } },
      { $addFields: { monthCount: { $size: '$months' } } },
      { $sort: { monthCount: -1, total: -1 } }, { $limit: 10 },
    ]);
    if (!result.length) return { text: 'Không có dữ liệu.' };
    const lines = result.map((r, i) => `  ${i + 1}. **${r._id}**: ${r.monthCount} tháng liên tục, ${r.count} HĐ, ${fmtVND(r.total)}`);
    return { text: `🏆 **Khách hàng trung thành (mua thường xuyên)**\n\n${lines.join('\n')}` };
  },

  // ── Supplier ──────────────────────────────────────────
  async top_suppliers(companyId, dateRange, entities) {
    const limit = entities?.limit || 10;
    const result = await Invoice.aggregate([
      { $match: { company_id: companyId, type: 'purchase', invoiceDate: dateRange } },
      { $group: { _id: { name: '$seller.name', taxCode: '$seller.taxCode' }, total: { $sum: '$totalAmount' }, count: { $sum: 1 }, avg: { $avg: '$totalAmount' } } },
      { $sort: { total: -1 } }, { $limit: limit },
    ]);
    if (!result.length) return { text: 'Chưa có dữ liệu nhà cung cấp.' };
    const totalExp = result.reduce((s, r) => s + r.total, 0);
    const lines = result.map((r, i) => {
      const pct = ((r.total / totalExp) * 100).toFixed(1);
      return `  ${i + 1}. **${r._id.name}** (MST: ${r._id.taxCode || 'N/A'})\n     ${fmtVND(r.total)} | ${r.count} HĐ | ${pct}% tổng CP`;
    });
    const chartData = result.slice(0, 10).map(r => ({ label: (r._id.name || '').slice(0, 25), value: r.total }));
    return {
      text: `🏭 **Top ${limit} Nhà cung cấp**\n\n${lines.join('\n')}`,
      chartData: [
        { type: 'bar', data: chartData, xKey: 'label', yKey: 'value', label: 'Chi phí theo NCC' },
        { type: 'pie', data: chartData.slice(0, 6), xKey: 'label', yKey: 'value', label: 'Tỷ trọng NCC' },
      ],
    };
  },

  async supplier_detail(companyId, dateRange, entities) {
    const match = { company_id: companyId, type: 'purchase', invoiceDate: dateRange };
    if (entities?.entityName) match['seller.name'] = { $regex: entities.entityName, $options: 'i' };
    else if (entities?.taxCode) match['seller.taxCode'] = entities.taxCode;
    else return { text: 'Vui lòng chỉ định tên hoặc MST nhà cung cấp.' };
    const summary = await Invoice.aggregate([
      { $match: match },
      { $group: { _id: { name: '$seller.name', taxCode: '$seller.taxCode' }, total: { $sum: '$totalAmount' }, tax: { $sum: '$taxAmount' }, count: { $sum: 1 }, avg: { $avg: '$totalAmount' } } },
    ]);
    if (!summary.length) return { text: `Không tìm thấy NCC "${entities.entityName || entities.taxCode}".` };
    const d = summary[0];
    return {
      text: `🏭 **Chi tiết NCC: ${d._id.name}**\nMST: ${d._id.taxCode || 'N/A'}\n\n` +
        `- Tổng chi phí: **${fmtVND(d.total)}**\n- Thuế: ${fmtVND(d.tax)}\n- Số HĐ: ${d.count}\n- TB/HĐ: ${fmtVND(d.avg)}`,
    };
  },

  // ── Product / Item ────────────────────────────────────
  async top_products(companyId, dateRange, entities) {
    const limit = entities?.limit || 10;
    const result = await InvoiceItem.aggregate([
      { $match: { company_id: companyId } },
      { $lookup: { from: 'invoices', localField: 'invoice_id', foreignField: '_id', as: 'inv' } },
      { $unwind: '$inv' },
      { $match: { 'inv.invoiceDate': dateRange, 'inv.type': 'sale' } },
      { $group: { _id: '$productName', totalRevenue: { $sum: '$preTaxAmount' }, totalQty: { $sum: '$quantity' }, count: { $sum: 1 } } },
      { $sort: { totalRevenue: -1 } }, { $limit: limit },
    ]);
    if (!result.length) return { text: 'Chưa có dữ liệu sản phẩm.' };
    const lines = result.map((r, i) => `  ${i + 1}. **${r._id}**\n     DT: ${fmtVND(r.totalRevenue)} | SL: ${r.totalQty} | ${r.count} lần bán`);
    return { text: `📦 **Top ${limit} Sản phẩm/Dịch vụ bán chạy**\n\n${lines.join('\n')}` };
  },

  async product_summary(companyId, dateRange, entities) {
    const matchStage = { company_id: companyId };
    const invoiceMatch = { 'inv.invoiceDate': dateRange };
    if (entities?.productName) matchStage.productName = { $regex: entities.productName, $options: 'i' };

    const result = await InvoiceItem.aggregate([
      { $match: matchStage },
      { $lookup: { from: 'invoices', localField: 'invoice_id', foreignField: '_id', as: 'inv' } },
      { $unwind: '$inv' },
      { $match: invoiceMatch },
      { $group: { _id: { product: '$productName', type: '$inv.type' }, total: { $sum: '$preTaxAmount' }, qty: { $sum: '$quantity' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }, { $limit: 20 },
    ]);
    if (!result.length) return { text: 'Chưa có dữ liệu sản phẩm/dịch vụ.' };
    const lines = result.map(r => {
      const typeLabel = r._id.type === 'sale' ? '🔵 Bán' : '🔴 Mua';
      return `  ${typeLabel} **${r._id.product}**: ${fmtVND(r.total)} (SL: ${r.qty}, ${r.count} HĐ)`;
    });
    return { text: `📦 **Phân tích sản phẩm/dịch vụ**\n\n${lines.join('\n')}` };
  },

  // ── Tax ───────────────────────────────────────────────
  async tax_summary(companyId, dateRange) {
    const [saleTax, purchaseTax] = await Promise.all([
      InvoiceItem.aggregate([
        { $match: { company_id: companyId } },
        { $lookup: { from: 'invoices', localField: 'invoice_id', foreignField: '_id', as: 'inv' } },
        { $unwind: '$inv' },
        { $match: { 'inv.invoiceDate': dateRange, 'inv.type': 'sale' } },
        { $group: { _id: '$taxRate', totalTax: { $sum: '$taxAmount' }, totalPreTax: { $sum: '$preTaxAmount' }, count: { $sum: 1 } } },
        { $sort: { totalTax: -1 } },
      ]),
      InvoiceItem.aggregate([
        { $match: { company_id: companyId } },
        { $lookup: { from: 'invoices', localField: 'invoice_id', foreignField: '_id', as: 'inv' } },
        { $unwind: '$inv' },
        { $match: { 'inv.invoiceDate': dateRange, 'inv.type': 'purchase' } },
        { $group: { _id: '$taxRate', totalTax: { $sum: '$taxAmount' }, totalPreTax: { $sum: '$preTaxAmount' }, count: { $sum: 1 } } },
        { $sort: { totalTax: -1 } },
      ]),
    ]);
    const totalSaleTax = saleTax.reduce((s, r) => s + r.totalTax, 0);
    const totalPurchaseTax = purchaseTax.reduce((s, r) => s + r.totalTax, 0);
    const netTax = totalSaleTax - totalPurchaseTax;
    let text = `🧾 **Phân tích thuế chi tiết**\n\n`;
    text += `**Thuế bán ra (đầu ra):** ${fmtVND(totalSaleTax)}\n`;
    saleTax.forEach(r => { text += `  - ${r._id}%: ${fmtVND(r.totalTax)} trên ${fmtVND(r.totalPreTax)} (${r.count} dòng)\n`; });
    text += `\n**Thuế mua vào (đầu vào):** ${fmtVND(totalPurchaseTax)}\n`;
    purchaseTax.forEach(r => { text += `  - ${r._id}%: ${fmtVND(r.totalTax)} trên ${fmtVND(r.totalPreTax)} (${r.count} dòng)\n`; });
    text += `\n**Thuế GTGT phải nộp (ước tính): ${fmtVND(Math.max(0, netTax))}**`;
    if (netTax < 0) text += `\n(Thuế đầu vào > đầu ra → được khấu trừ ${fmtVND(Math.abs(netTax))})`;
    const pieData = saleTax.map(r => ({ label: `Bán ${r._id}%`, value: r.totalTax })).concat(purchaseTax.map(r => ({ label: `Mua ${r._id}%`, value: r.totalTax })));
    return {
      text,
      chartData: pieData.length ? { type: 'pie', data: pieData, xKey: 'label', yKey: 'value', label: 'Phân bổ thuế theo thuế suất' } : undefined,
    };
  },

  async tax_payable(companyId, dateRange) { return queryHandlers.tax_summary(companyId, dateRange); },
  async tax_deductible(companyId, dateRange) { return queryHandlers.tax_summary(companyId, dateRange); },

  // ── Invoice ───────────────────────────────────────────
  async invoice_count(companyId, dateRange) {
    const result = await Invoice.aggregate([
      { $match: { company_id: companyId, invoiceDate: dateRange } },
      { $group: { _id: '$type', count: { $sum: 1 }, total: { $sum: '$totalAmount' } } },
    ]);
    const sale = result.find(r => r._id === 'sale') || { count: 0, total: 0 };
    const purchase = result.find(r => r._id === 'purchase') || { count: 0, total: 0 };
    return {
      text: `📋 **Thống kê hóa đơn**\n\n` +
        `- Bán ra: **${sale.count}** HĐ (${fmtVND(sale.total)})\n` +
        `- Mua vào: **${purchase.count}** HĐ (${fmtVND(purchase.total)})\n` +
        `- Tổng: **${sale.count + purchase.count}** HĐ`,
    };
  },

  async invoice_summary(companyId, dateRange) {
    const [byStatus, byMonth] = await Promise.all([
      Invoice.aggregate([
        { $match: { company_id: companyId, invoiceDate: dateRange } },
        { $group: { _id: { type: '$type', status: '$status' }, count: { $sum: 1 } } },
      ]),
      Invoice.aggregate([
        { $match: { company_id: companyId, invoiceDate: dateRange } },
        { $group: { _id: { month: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } }, type: '$type' }, count: { $sum: 1 }, total: { $sum: '$totalAmount' } } },
        { $sort: { '_id.month': 1 } },
      ]),
    ]);
    let text = `📋 **Tổng quan hóa đơn**\n\n**Theo trạng thái:**\n`;
    const statusMap = {};
    byStatus.forEach(r => {
      const key = `${r._id.type === 'sale' ? 'Bán ra' : 'Mua vào'} - ${r._id.status}`;
      statusMap[key] = r.count;
    });
    Object.entries(statusMap).forEach(([k, v]) => { text += `  - ${k}: ${v}\n`; });
    if (byMonth.length) {
      text += `\n**Theo tháng:**\n`;
      const grouped = {};
      byMonth.forEach(r => {
        if (!grouped[r._id.month]) grouped[r._id.month] = {};
        grouped[r._id.month][r._id.type] = { count: r.count, total: r.total };
      });
      Object.entries(grouped).sort().forEach(([m, types]) => {
        const s = types.sale || { count: 0, total: 0 };
        const p = types.purchase || { count: 0, total: 0 };
        text += `  ${m}: Bán ${s.count} (${fmtVND(s.total)}) | Mua ${p.count} (${fmtVND(p.total)})\n`;
      });
    }
    return { text };
  },

  async invoice_lookup(companyId, dateRange, entities) {
    const query = { company_id: companyId };
    if (entities?.invoiceNumber) query.invoiceNumber = entities.invoiceNumber;
    else return { text: 'Vui lòng nhập số hóa đơn. VD: "Hóa đơn số 153"' };
    const invoices = await Invoice.find(query).lean();
    if (!invoices.length) return { text: `Không tìm thấy hóa đơn số ${entities.invoiceNumber}.` };
    const lines = await Promise.all(invoices.map(async (inv) => {
      const items = await InvoiceItem.find({ invoice_id: inv._id }).lean();
      let text = `📄 **HĐ #${inv.invoiceNumber}** (${inv.invoiceSymbol})\n` +
        `  Loại: ${inv.type === 'sale' ? 'Bán ra' : 'Mua vào'}\n` +
        `  Ngày: ${inv.invoiceDate?.toLocaleDateString('vi-VN')}\n` +
        `  ${inv.type === 'sale' ? 'Người mua' : 'Người bán'}: ${inv.type === 'sale' ? inv.buyer?.name : inv.seller?.name}\n` +
        `  Tổng: **${fmtVND(inv.totalAmount)}** | Thuế: ${fmtVND(inv.taxAmount)}\n` +
        `  Trạng thái: ${inv.status} | Thanh toán: ${inv.paymentMethod}`;
      if (items.length) {
        text += `\n  **Chi tiết hàng hóa:**`;
        items.forEach(it => {
          text += `\n    - ${it.productName}: ${it.quantity} ${it.unit} x ${fmtVND(it.unitPrice)} = ${fmtVND(it.preTaxAmount)} (VAT ${it.taxRate}%)`;
        });
      }
      return text;
    }));
    return { text: lines.join('\n\n') };
  },

  async recent_invoices(companyId, dateRange) {
    const invoices = await Invoice.find({ company_id: companyId, invoiceDate: dateRange })
      .sort({ invoiceDate: -1 }).limit(15).lean();
    if (!invoices.length) return { text: 'Không có hóa đơn gần đây.' };
    const lines = invoices.map(inv => {
      const type = inv.type === 'sale' ? '🔵' : '🔴';
      const partner = inv.type === 'sale' ? inv.buyer?.name : inv.seller?.name;
      return `  ${type} #${inv.invoiceNumber} | ${inv.invoiceDate?.toLocaleDateString('vi-VN')} | ${(partner || '').slice(0, 30)} | ${fmtVND(inv.totalAmount)}`;
    });
    return { text: `📋 **15 hóa đơn gần nhất**\n🔵 Bán ra | 🔴 Mua vào\n\n${lines.join('\n')}` };
  },

  async largest_invoices(companyId, dateRange) {
    const invoices = await Invoice.find({ company_id: companyId, invoiceDate: dateRange })
      .sort({ totalAmount: -1 }).limit(10).lean();
    if (!invoices.length) return { text: 'Không có dữ liệu.' };
    const lines = invoices.map((inv, i) => {
      const type = inv.type === 'sale' ? '🔵' : '🔴';
      const partner = inv.type === 'sale' ? inv.buyer?.name : inv.seller?.name;
      return `  ${i + 1}. ${type} **${fmtVND(inv.totalAmount)}** | #${inv.invoiceNumber} | ${inv.invoiceDate?.toLocaleDateString('vi-VN')} | ${(partner || '').slice(0, 30)}`;
    });
    return { text: `📋 **10 hóa đơn giá trị lớn nhất**\n\n${lines.join('\n')}` };
  },

  async special_invoices(companyId, dateRange) {
    const invoices = await Invoice.find({
      company_id: companyId, invoiceDate: dateRange,
      status: { $in: ['replaced', 'adjusted', 'cancelled'] },
    }).sort({ invoiceDate: -1 }).limit(20).lean();
    if (!invoices.length) return { text: 'Không có hóa đơn hủy/thay thế/điều chỉnh trong khoảng thời gian này.' };
    const lines = invoices.map(inv => {
      const statusEmoji = inv.status === 'cancelled' ? '❌' : inv.status === 'replaced' ? '🔄' : '✏️';
      return `  ${statusEmoji} #${inv.invoiceNumber} | ${inv.status} | ${inv.invoiceDate?.toLocaleDateString('vi-VN')} | ${fmtVND(inv.totalAmount)}`;
    });
    return { text: `⚠️ **Hóa đơn đặc biệt (hủy/thay thế/điều chỉnh)**\n\n${lines.join('\n')}` };
  },

  // ── Cash Flow ─────────────────────────────────────────
  async cashflow(companyId, dateRange) {
    const result = await Invoice.aggregate([
      { $match: { company_id: companyId, invoiceDate: dateRange } },
      { $group: { _id: { month: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } }, type: '$type' }, total: { $sum: '$totalAmount' } } },
      { $sort: { '_id.month': 1 } },
    ]);
    if (!result.length) return { text: 'Không có dữ liệu dòng tiền.' };
    const byMonth = {};
    result.forEach(r => {
      if (!byMonth[r._id.month]) byMonth[r._id.month] = { inflow: 0, outflow: 0 };
      if (r._id.type === 'sale') byMonth[r._id.month].inflow = r.total;
      else byMonth[r._id.month].outflow = r.total;
    });
    let cumulative = 0;
    const entries = Object.entries(byMonth).sort();
    const lines = entries.map(([m, v]) => {
      const net = v.inflow - v.outflow;
      cumulative += net;
      return `  ${m}: Vào ${fmtVND(v.inflow)} | Ra ${fmtVND(v.outflow)} | Ròng **${fmtVND(net)}** | Lũy kế ${fmtVND(cumulative)}`;
    });
    const chartData = entries.map(([m, v]) => ({ period: m, inflow: v.inflow, outflow: v.outflow, net: v.inflow - v.outflow }));
    return {
      text: `💵 **Phân tích dòng tiền**\n\n${lines.join('\n')}`,
      chartData: { type: 'composed', data: chartData, xKey: 'period', yKey: 'net', label: 'Tiền vào / Tiền ra / Ròng' },
    };
  },

  // ── Comparison ────────────────────────────────────────
  async compare_months(companyId, dateRange) {
    const result = await Invoice.aggregate([
      { $match: { company_id: companyId, invoiceDate: dateRange } },
      { $group: { _id: { month: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } }, type: '$type' }, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { '_id.month': 1 } },
    ]);
    if (!result.length) return { text: 'Không có dữ liệu để so sánh.' };
    const byMonth = {};
    result.forEach(r => {
      if (!byMonth[r._id.month]) byMonth[r._id.month] = {};
      byMonth[r._id.month][r._id.type] = { total: r.total, count: r.count };
    });
    const entries = Object.entries(byMonth).sort();
    const lines = entries.map(([m, types], i) => {
      const s = types.sale || { total: 0, count: 0 };
      const p = types.purchase || { total: 0, count: 0 };
      const profit = s.total - p.total;
      let growth = '';
      if (i > 0) {
        const prev = Object.values(byMonth)[i - 1];
        const prevProfit = (prev.sale?.total || 0) - (prev.purchase?.total || 0);
        growth = ` ${pctChange(profit, prevProfit)}`;
      }
      return `  **${m}**: DT ${fmtVND(s.total)} (${s.count} HĐ) | CP ${fmtVND(p.total)} (${p.count} HĐ) | LN ${fmtVND(profit)}${growth}`;
    });
    const chartData = entries.map(([m, types]) => ({
      period: m,
      revenue: types.sale?.total || 0,
      expense: types.purchase?.total || 0,
      profit: (types.sale?.total || 0) - (types.purchase?.total || 0),
    }));
    return {
      text: `📊 **So sánh theo tháng**\n\n${lines.join('\n')}`,
      chartData: { type: 'composed', data: chartData, xKey: 'period', yKey: 'revenue', label: 'Doanh thu / Chi phí / Lợi nhuận' },
    };
  },

  async compare_quarters(companyId, dateRange) {
    const result = await Invoice.aggregate([
      { $match: { company_id: companyId, invoiceDate: dateRange } },
      { $group: { _id: { q: { $ceil: { $divide: [{ $month: '$invoiceDate' }, 3] } }, y: { $year: '$invoiceDate' }, type: '$type' }, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { '_id.y': 1, '_id.q': 1 } },
    ]);
    if (!result.length) return { text: 'Không có dữ liệu để so sánh quý.' };
    const byQ = {};
    result.forEach(r => {
      const key = `Q${r._id.q}/${r._id.y}`;
      if (!byQ[key]) byQ[key] = {};
      byQ[key][r._id.type] = { total: r.total, count: r.count };
    });
    const lines = Object.entries(byQ).map(([q, types]) => {
      const s = types.sale || { total: 0, count: 0 };
      const p = types.purchase || { total: 0, count: 0 };
      return `  **${q}**: DT ${fmtVND(s.total)} | CP ${fmtVND(p.total)} | LN ${fmtVND(s.total - p.total)}`;
    });
    return { text: `📊 **So sánh theo quý**\n\n${lines.join('\n')}` };
  },

  async compare_customers(companyId, dateRange) {
    const result = await Invoice.aggregate([
      { $match: { company_id: companyId, type: 'sale', invoiceDate: dateRange } },
      { $group: { _id: '$buyer.name', total: { $sum: '$totalAmount' }, count: { $sum: 1 }, avg: { $avg: '$totalAmount' } } },
      { $sort: { total: -1 } }, { $limit: 10 },
    ]);
    if (!result.length) return { text: 'Không có dữ liệu.' };
    const totalAll = result.reduce((s, r) => s + r.total, 0);
    const lines = result.map((r, i) => `  ${i + 1}. **${r._id}**: ${fmtVND(r.total)} (${((r.total / totalAll) * 100).toFixed(1)}%) - ${r.count} HĐ - TB ${fmtVND(r.avg)}`);
    return { text: `📊 **So sánh khách hàng**\n\n${lines.join('\n')}` };
  },

  async compare_suppliers(companyId, dateRange) {
    const result = await Invoice.aggregate([
      { $match: { company_id: companyId, type: 'purchase', invoiceDate: dateRange } },
      { $group: { _id: '$seller.name', total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }, { $limit: 10 },
    ]);
    if (!result.length) return { text: 'Không có dữ liệu.' };
    const totalAll = result.reduce((s, r) => s + r.total, 0);
    const lines = result.map((r, i) => `  ${i + 1}. **${r._id}**: ${fmtVND(r.total)} (${((r.total / totalAll) * 100).toFixed(1)}%) - ${r.count} HĐ`);
    return { text: `📊 **So sánh nhà cung cấp**\n\n${lines.join('\n')}` };
  },

  // ── Anomaly Detection ─────────────────────────────────
  async anomaly_detect(companyId, dateRange) {
    const monthly = await Invoice.aggregate([
      { $match: { company_id: companyId, invoiceDate: dateRange } },
      { $group: { _id: { month: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } }, type: '$type' }, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { '_id.month': 1 } },
    ]);
    if (monthly.length < 3) return { text: 'Cần ít nhất 3 tháng dữ liệu để phát hiện bất thường.' };

    // Find anomalies: months where value > 2x average
    const byType = { sale: [], purchase: [] };
    monthly.forEach(r => { if (byType[r._id.type]) byType[r._id.type].push({ month: r._id.month, total: r.total }); });

    let text = `🔍 **Phân tích bất thường**\n\n`;
    for (const [type, data] of Object.entries(byType)) {
      if (data.length < 2) continue;
      const avg = data.reduce((s, d) => s + d.total, 0) / data.length;
      const anomalies = data.filter(d => d.total > avg * 1.5 || d.total < avg * 0.5);
      const label = type === 'sale' ? 'Doanh thu' : 'Chi phí';
      text += `**${label}** (TB: ${fmtVND(avg)}):\n`;
      if (anomalies.length === 0) {
        text += `  ✅ Không phát hiện bất thường\n`;
      } else {
        anomalies.forEach(a => {
          const ratio = (a.total / avg).toFixed(1);
          const emoji = a.total > avg ? '⚠️ Cao' : '⚠️ Thấp';
          text += `  ${emoji}: ${a.month} = ${fmtVND(a.total)} (${ratio}x so với TB)\n`;
        });
      }
      text += '\n';
    }

    // Large single invoices
    const bigInvoices = await Invoice.find({
      company_id: companyId, invoiceDate: dateRange,
    }).sort({ totalAmount: -1 }).limit(5).lean();
    if (bigInvoices.length) {
      text += `**Hóa đơn giá trị lớn nhất:**\n`;
      bigInvoices.forEach(inv => {
        text += `  ${inv.type === 'sale' ? '🔵' : '🔴'} #${inv.invoiceNumber}: ${fmtVND(inv.totalAmount)} (${inv.invoiceDate?.toLocaleDateString('vi-VN')})\n`;
      });
    }
    return { text };
  },

  // ── Period Shortcuts ──────────────────────────────────
  async current_month(companyId) {
    const now = new Date();
    const dateRange = {
      $gte: new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)),
      $lte: now,
    };
    return queryHandlers.overview(companyId, dateRange);
  },

  async last_month(companyId) {
    const now = new Date();
    const dateRange = {
      $gte: new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1)),
      $lte: new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)),
    };
    return queryHandlers.overview(companyId, dateRange);
  },

  async current_quarter(companyId) {
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3);
    const dateRange = {
      $gte: new Date(Date.UTC(now.getFullYear(), q * 3, 1)),
      $lte: now,
    };
    return queryHandlers.overview(companyId, dateRange);
  },

  async yearly_summary(companyId, dateRange) {
    const [overview, monthlyTrend] = await Promise.all([
      queryHandlers.overview(companyId, dateRange),
      queryHandlers.compare_months(companyId, dateRange),
    ]);
    return { text: overview.text + '\n\n' + monthlyTrend.text, chartData: monthlyTrend.chartData };
  },

  // ── Overview ──────────────────────────────────────────
  async overview(companyId, dateRange) {
    const [revResult, expResult, invoicesByStatus] = await Promise.all([
      Invoice.aggregate([
        { $match: { company_id: companyId, type: 'sale', invoiceDate: dateRange } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, subtotal: { $sum: '$subtotal' }, tax: { $sum: '$taxAmount' }, count: { $sum: 1 }, avg: { $avg: '$totalAmount' } } },
      ]),
      Invoice.aggregate([
        { $match: { company_id: companyId, type: 'purchase', invoiceDate: dateRange } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, subtotal: { $sum: '$subtotal' }, tax: { $sum: '$taxAmount' }, count: { $sum: 1 }, avg: { $avg: '$totalAmount' } } },
      ]),
      Invoice.aggregate([
        { $match: { company_id: companyId, invoiceDate: dateRange } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);
    const rev = revResult[0] || { total: 0, subtotal: 0, tax: 0, count: 0, avg: 0 };
    const exp = expResult[0] || { total: 0, subtotal: 0, tax: 0, count: 0, avg: 0 };
    const profit = rev.total - exp.total;
    const margin = rev.total > 0 ? ((profit / rev.total) * 100).toFixed(1) : '0';
    const statusText = invoicesByStatus.map(s => `${s._id}: ${s.count}`).join(', ');

    return {
      text: `📊 **Tổng quan tài chính**\n\n` +
        `**Doanh thu:**\n- Tổng: **${fmtVND(rev.total)}**\n- Chưa thuế: ${fmtVND(rev.subtotal)}\n- Thuế: ${fmtVND(rev.tax)}\n- Số HĐ: ${rev.count} | TB: ${fmtVND(rev.avg)}\n\n` +
        `**Chi phí:**\n- Tổng: **${fmtVND(exp.total)}**\n- Chưa thuế: ${fmtVND(exp.subtotal)}\n- Thuế: ${fmtVND(exp.tax)}\n- Số HĐ: ${exp.count} | TB: ${fmtVND(exp.avg)}\n\n` +
        `**Lợi nhuận gộp: ${fmtVND(profit)}** (biên LN: ${margin}%)\n` +
        `**Thuế GTGT phải nộp: ${fmtVND(Math.max(0, rev.tax - exp.tax))}**\n` +
        (statusText ? `\nTrạng thái HĐ: ${statusText}` : ''),
    };
  },

  // ── Greeting / Help ───────────────────────────────────
  async greeting() {
    return {
      text: `Xin chào! 👋 Tôi là **FinTax AI**, trợ lý phân tích tài chính của bạn.\n\nBạn có thể hỏi tôi bất cứ điều gì về dữ liệu tài chính công ty. Ví dụ:\n` +
        `- "Doanh thu tháng này bao nhiêu?"\n- "So sánh doanh thu 6 tháng gần nhất"\n- "Top 10 khách hàng"\n- "Hóa đơn số 153"\n- "Phân tích lợi nhuận quý 2"`,
    };
  },

  async help() {
    return { text: HELP_TEXT };
  },
};

// ═══════════════════════════════════════════════════════════
// ─── DEEP CONTEXT (for unknown intents) ───────────────────
// ═══════════════════════════════════════════════════════════
/**
 * When intent is unknown, query comprehensive data so
 * the LLM has enough context to answer ANY question.
 */
async function buildDeepContext(companyId, dateRange, entities) {
  const queries = [
    // Full overview
    queryHandlers.overview(companyId, dateRange),
    // Monthly comparison
    Invoice.aggregate([
      { $match: { company_id: companyId, invoiceDate: dateRange } },
      { $group: { _id: { month: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } }, type: '$type' }, total: { $sum: '$totalAmount' }, tax: { $sum: '$taxAmount' }, count: { $sum: 1 } } },
      { $sort: { '_id.month': 1 } },
    ]),
    // Top 5 customers
    Invoice.aggregate([
      { $match: { company_id: companyId, type: 'sale', invoiceDate: dateRange } },
      { $group: { _id: '$buyer.name', total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }, { $limit: 5 },
    ]),
    // Top 5 suppliers
    Invoice.aggregate([
      { $match: { company_id: companyId, type: 'purchase', invoiceDate: dateRange } },
      { $group: { _id: '$seller.name', total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }, { $limit: 5 },
    ]),
    // Top 5 products
    InvoiceItem.aggregate([
      { $match: { company_id: companyId } },
      { $lookup: { from: 'invoices', localField: 'invoice_id', foreignField: '_id', as: 'inv' } },
      { $unwind: '$inv' },
      { $match: { 'inv.invoiceDate': dateRange } },
      { $group: { _id: '$productName', total: { $sum: '$preTaxAmount' }, qty: { $sum: '$quantity' } } },
      { $sort: { total: -1 } }, { $limit: 5 },
    ]),
    // Recent 10 invoices
    Invoice.find({ company_id: companyId, invoiceDate: dateRange })
      .sort({ invoiceDate: -1 }).limit(10)
      .select('invoiceNumber invoiceDate type totalAmount buyer.name seller.name status').lean(),
  ];

  // If entity name mentioned, also search for that entity
  if (entities?.entityName) {
    queries.push(
      Invoice.find({
        company_id: companyId, invoiceDate: dateRange,
        $or: [
          { 'buyer.name': { $regex: entities.entityName, $options: 'i' } },
          { 'seller.name': { $regex: entities.entityName, $options: 'i' } },
        ],
      }).sort({ invoiceDate: -1 }).limit(10).select('invoiceNumber invoiceDate type totalAmount buyer.name seller.name').lean()
    );
  }

  const [overviewResult, monthly, topCust, topSupp, topProds, recentInv, entityInv] = await Promise.all(queries);

  let ctx = overviewResult.text + '\n\n';

  // Monthly breakdown
  ctx += '**Dữ liệu theo tháng:**\n';
  const byMonth = {};
  monthly.forEach(r => {
    if (!byMonth[r._id.month]) byMonth[r._id.month] = {};
    byMonth[r._id.month][r._id.type] = { total: r.total, tax: r.tax, count: r.count };
  });
  Object.entries(byMonth).sort().forEach(([m, types]) => {
    const s = types.sale || { total: 0, count: 0, tax: 0 };
    const p = types.purchase || { total: 0, count: 0, tax: 0 };
    ctx += `  ${m}: DT ${fmtVND(s.total)} (${s.count} HĐ, thuế ${fmtVND(s.tax)}) | CP ${fmtVND(p.total)} (${p.count} HĐ, thuế ${fmtVND(p.tax)}) | LN ${fmtVND(s.total - p.total)}\n`;
  });

  // Customers
  if (topCust.length) {
    ctx += '\n**Top 5 KH:** ' + topCust.map((c, i) => `${i + 1}. ${c._id}: ${fmtVND(c.total)} (${c.count} HĐ)`).join(' | ') + '\n';
  }

  // Suppliers
  if (topSupp.length) {
    ctx += '**Top 5 NCC:** ' + topSupp.map((s, i) => `${i + 1}. ${s._id}: ${fmtVND(s.total)} (${s.count} HĐ)`).join(' | ') + '\n';
  }

  // Products
  if (topProds.length) {
    ctx += '**Top 5 SP/DV:** ' + topProds.map((p, i) => `${i + 1}. ${p._id}: ${fmtVND(p.total)} (SL: ${p.qty})`).join(' | ') + '\n';
  }

  // Recent invoices
  if (recentInv.length) {
    ctx += '\n**10 HĐ gần nhất:**\n';
    recentInv.forEach(inv => {
      const partner = inv.type === 'sale' ? inv.buyer?.name : inv.seller?.name;
      ctx += `  #${inv.invoiceNumber} | ${inv.invoiceDate?.toLocaleDateString('vi-VN')} | ${inv.type === 'sale' ? 'Bán' : 'Mua'} | ${(partner || '').slice(0, 30)} | ${fmtVND(inv.totalAmount)} | ${inv.status}\n`;
    });
  }

  // Entity-specific data
  if (entityInv && entityInv.length) {
    ctx += `\n**Hóa đơn liên quan "${entities.entityName}":**\n`;
    entityInv.forEach(inv => {
      ctx += `  #${inv.invoiceNumber} | ${inv.invoiceDate?.toLocaleDateString('vi-VN')} | ${inv.type === 'sale' ? 'Bán' : 'Mua'} | ${fmtVND(inv.totalAmount)}\n`;
    });
  }

  return ctx;
}

// ═══════════════════════════════════════════════════════════
// ─── HELP TEXT ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════
const HELP_TEXT =
  `Tôi có thể phân tích:\n\n` +
  `📊 **Doanh thu**: "Tổng doanh thu tháng 6", "Doanh thu quý 2", "Doanh thu hàng ngày"\n` +
  `💸 **Chi phí**: "Chi phí mua vào 6 tháng gần nhất", "Xu hướng chi phí"\n` +
  `💰 **Lợi nhuận**: "Phân tích lợi nhuận năm 2025", "Biên lợi nhuận"\n` +
  `👥 **Khách hàng**: "Top 10 khách hàng", "Khách hàng mới", "KH trung thành", "Chi tiết KH LILAMA"\n` +
  `🏭 **Nhà cung cấp**: "Top nhà cung cấp", "Chi tiết NCC ABC"\n` +
  `📦 **Sản phẩm**: "Top sản phẩm bán chạy", "Phân tích sản phẩm"\n` +
  `🧾 **Thuế**: "Phân bổ thuế suất", "Thuế phải nộp", "Thuế khấu trừ"\n` +
  `📈 **Xu hướng**: "Xu hướng doanh thu 6 tháng", "Tăng trưởng chi phí"\n` +
  `📋 **Hóa đơn**: "Hóa đơn số 153", "15 HĐ gần nhất", "HĐ lớn nhất", "HĐ bị hủy"\n` +
  `💵 **Dòng tiền**: "Phân tích dòng tiền", "Thu chi theo tháng"\n` +
  `📊 **So sánh**: "So sánh theo tháng", "So sánh theo quý", "So sánh khách hàng"\n` +
  `🔍 **Bất thường**: "Phát hiện bất thường", "Chi phí đột biến"\n` +
  `📅 **Thời gian**: "Tháng này", "Tháng trước", "Quý 2/2025", "Từ tháng 1 đến tháng 6"`;

// ═══════════════════════════════════════════════════════════
// ─── MAIN PROCESS QUERY ───────────────────────────────────
// ═══════════════════════════════════════════════════════════
/**
 * Process a user message and return AI response.
 * Pipeline:
 *   1. Detect intent from Vietnamese NLP
 *   2. Extract date range + entities
 *   3. If Groq available → query DB + send to LLM
 *   4. Otherwise → rule-based response
 */
const processQuery = async (message, companyId, chatMessages = null) => {
  const normalizeResponse = (result, intentValue) => {
    const safeResult = result || {};
    const text = typeof safeResult.text === 'string' ? safeResult.text : '';
    const legacyChart = safeResult.chartData || null;
    const charts = Array.isArray(legacyChart) ? legacyChart : legacyChart ? [legacyChart] : [];
    const payload = safeResult.responsePayload || {};

    const normalizedText = hasNoDataSignal(text) ? NO_DATA_FALLBACK_TEXT : text;
    const markdown = typeof payload.markdown === 'string'
      ? (hasNoDataSignal(payload.markdown) ? NO_DATA_FALLBACK_TEXT : payload.markdown)
      : normalizedText;
    const mermaid = hasNoDataSignal(normalizedText) ? [] : (Array.isArray(payload.mermaid) ? payload.mermaid : []);
    const images = hasNoDataSignal(normalizedText) ? [] : (Array.isArray(payload.images) ? payload.images : []);
    const normalizedCharts = hasNoDataSignal(normalizedText) ? [] : charts;

    let confidence = Number(payload.confidence);
    if (Number.isNaN(confidence)) {
      confidence = intentValue === 'unknown' ? 0.55 : 0.75;
    }
    if (hasNoDataSignal(normalizedText)) {
      confidence = Math.min(confidence, 0.6);
    }
    confidence = Math.max(0, Math.min(1, confidence));

    return {
      ...safeResult,
      text: normalizedText,
      chartData: normalizedCharts.length ? legacyChart : null,
      intent: intentValue,
      responsePayload: {
        markdown,
        charts: normalizedCharts,
        mermaid,
        images,
        confidence,
      },
    };
  };

  const intent = detectIntent(message);
  const entities = extractEntities(message);

  // Determine anchor year from latest invoice for smarter date defaults
  let dateRange;
  if (hasExplicitDateRange(message)) {
    const latest = await Invoice.findOne({ company_id: companyId })
      .sort({ invoiceDate: -1 })
      .select('invoiceDate')
      .lean();
    const anchorYear = latest?.invoiceDate
      ? new Date(latest.invoiceDate).getUTCFullYear()
      : new Date().getFullYear();
    dateRange = extractDateRange(message, anchorYear);
  } else {
    dateRange = await getSmartDefaultDateRange(companyId);
  }

  // ── RAG Path (Groq available) ─────────────────────────
  if (ragService.isAvailable()) {
    let structuredData = null;
    let ruleResultForGuardrail = null;

    if (intent !== 'unknown' && intent !== 'greeting' && intent !== 'help') {
      // Known intent → run specific handler for precise data
      const handler = queryHandlers[intent] || queryHandlers.overview;
      ruleResultForGuardrail = await handler(companyId, dateRange, entities);
      structuredData = ruleResultForGuardrail.text;
    } else if (intent === 'unknown') {
      // Unknown intent → build deep context so LLM can answer anything
      structuredData = await buildDeepContext(companyId, dateRange, entities);
    }

    const ragResult = await ragService.generateResponse(
      message, companyId, structuredData, chatMessages
    );

    if (ragResult) {
      if (shouldFallbackFromRag({ structuredData, ragText: ragResult.text })) {
        if (ruleResultForGuardrail) {
          return normalizeResponse(ruleResultForGuardrail, intent);
        }
        return normalizeResponse({ text: NO_DATA_FALLBACK_TEXT }, intent);
      }

      return normalizeResponse({
        text: ragResult.text,
        chartData: ragResult.chartData || null,
        responsePayload: ragResult.responsePayload,
      }, intent);
    }
    // If RAG fails, fall through to rule-based
  }

  // ── Rule-based Path (fallback) ────────────────────────
  if (intent === 'unknown') {
    return normalizeResponse({ text: HELP_TEXT }, intent);
  }

  const handler = queryHandlers[intent] || queryHandlers.overview;
  const result = await handler(companyId, dateRange, entities);
  return normalizeResponse(result, intent);
};

module.exports = { detectIntent, extractDateRange, extractEntities, processQuery, fmtVND, HELP_TEXT };
