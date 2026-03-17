/**
 * RAG Service — Groq-powered intelligent responses with MongoDB context.
 *
 * Pipeline:
 *   1. Build financial context from real MongoDB data
 *   2. Combine with user query + any structured query results
 *   3. Send to Groq LLaMA 3.3 70B for natural language generation
 *   4. Parse response for text + optional chart data
 *
 * Falls back gracefully if Groq API key is not configured.
 */
const OpenAI = require('openai');
const env = require('../config/env');
const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const Company = require('../models/Company');

const groqClientByKey = new Map();
let keyRotationIndex = 0;

function getApiKeys() {
  return [env.groqApiKey, env.groqApiKey2].filter(Boolean);
}

function getModelChain() {
  const chain = [
    env.groqModelPrimary,
    env.groqModel,
    env.groqModelFallback,
    'openai/gpt-oss-120b',
    'llama-3.3-70b-versatile',
  ].filter(Boolean);
  return [...new Set(chain)];
}

function rotateKeys(keys) {
  if (!keys.length) return [];
  const start = keyRotationIndex % keys.length;
  keyRotationIndex = (keyRotationIndex + 1) % keys.length;
  return [...keys.slice(start), ...keys.slice(0, start)];
}

function getStatusCode(error) {
  return error?.status || error?.response?.status || error?.code || null;
}

function isRetryableError(error) {
  const status = getStatusCode(error);
  return status === 408
    || status === 409
    || status === 429
    || status === 500
    || status === 502
    || status === 503
    || status === 504;
}

function maskKey(key) {
  if (!key) return 'n/a';
  return `***${String(key).slice(-4)}`;
}

function parseJsonBlocks(raw, blockType) {
  const regex = new RegExp('```' + blockType + '\\n?([\\s\\S]*?)```', 'g');
  const items = [];
  let match;
  while ((match = regex.exec(raw)) !== null) {
    try {
      items.push(JSON.parse(match[1].trim()));
    } catch {
      // Ignore malformed blocks
    }
  }
  return items;
}

function parseMermaidBlocks(raw) {
  const regex = /```mermaid\n?([\s\S]*?)```/g;
  const items = [];
  let match;
  while ((match = regex.exec(raw)) !== null) {
    const code = match[1].trim();
    if (code) items.push({ code });
  }
  return items;
}

function parseImageBlocks(raw) {
  const jsonImages = parseJsonBlocks(raw, 'image').filter(Boolean).map((item) => ({
    url: item.url,
    alt: item.alt || '',
    caption: item.caption || '',
    mimeType: item.mimeType || '',
  })).filter((item) => typeof item.url === 'string' && item.url.trim());

  const markdownImages = [];
  const markdownRegex = /!\[([^\]]*)\]\(((?:https?:\/\/|\/)[^\s)]+)\)/g;
  let match;
  while ((match = markdownRegex.exec(raw)) !== null) {
    markdownImages.push({
      url: match[2],
      alt: match[1] || '',
      caption: '',
      mimeType: '',
    });
  }

  const all = [...jsonImages, ...markdownImages];
  const dedup = new Map();
  all.forEach((item) => {
    if (!dedup.has(item.url)) dedup.set(item.url, item);
  });
  return [...dedup.values()];
}

function parseConfidence(raw, fallback = 0.8) {
  const confidenceBlocks = parseJsonBlocks(raw, 'confidence');
  if (confidenceBlocks.length) {
    const val = Number(confidenceBlocks[0]?.score ?? confidenceBlocks[0]?.confidence);
    if (!Number.isNaN(val)) return Math.max(0, Math.min(1, val));
  }

  const inlineMatch = raw.match(/confidence\s*[:=]\s*(0(?:\.\d+)?|1(?:\.0+)?)/i);
  if (inlineMatch) {
    const val = Number(inlineMatch[1]);
    if (!Number.isNaN(val)) return Math.max(0, Math.min(1, val));
  }

  return Math.max(0, Math.min(1, fallback));
}

/** Lazily initialize Groq client (OpenAI-compatible SDK) */
function getClient(preferredKey = null) {
  const key = preferredKey || getApiKeys()[0];
  if (!key) return null;
  if (!groqClientByKey.has(key)) {
    groqClientByKey.set(key, new OpenAI({
      apiKey: key,
      baseURL: 'https://api.groq.com/openai/v1',
    }));
  }
  return groqClientByKey.get(key);
}

/** Check if RAG is available */
function isAvailable() {
  return getApiKeys().length > 0;
}

// ─── Format Helpers ─────────────────────────────────────
function fmtVND(n) {
  if (!n && n !== 0) return '0 ₫';
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)} tỷ ₫`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)} triệu ₫`;
  return `${n.toLocaleString('vi-VN')} ₫`;
}

// ─── System Prompt (Enhanced) ──────────────────────────
const SYSTEM_PROMPT = `Bạn là FinTax AI — trợ lý phân tích tài chính doanh nghiệp thông minh nhất, chuyên gia về thuế và kế toán Việt Nam. Bạn kết hợp khả năng phân tích dữ liệu, tư vấn chiến lược và trực quan hóa dữ liệu.

NHIỆM VỤ CHÍNH:
Phân tích toàn diện dữ liệu hóa đơn (bán ra / mua vào) của doanh nghiệp Việt Nam. Trả lời câu hỏi tài chính, thuế, dòng tiền, khách hàng, nhà cung cấp, sản phẩm. Đưa ra insight chuyên sâu, phát hiện patterns ẩn, cảnh báo rủi ro, gợi ý chiến lược.

KHẢ NĂNG PHÂN TÍCH NÂNG CAO:
- Doanh thu, chi phí, lợi nhuận: tổng, theo tháng/quý/năm, xu hướng, tăng trưởng, dự báo
- Khách hàng: top, chi tiết, mới, trung thành, RFM analysis, customer concentration risk
- Nhà cung cấp: top, dependency analysis, price change tracking
- Sản phẩm/dịch vụ: bán chạy, ABC analysis, margin analysis
- Thuế: GTGT đầu ra/vào, thuế phải nộp, khấu trừ, phân bổ thuế suất, VAT planning
- Dòng tiền: thu/chi, ròng, lũy kế, cash conversion cycle, working capital
- Phát hiện bất thường: z-score, đột biến giá trị, seasonal decomposition
- So sánh nâng cao: YoY, MoM, benchmark, cohort analysis

TƯ DUY PHÂN TÍCH (luôn áp dụng):
1. WHAT: Mô tả dữ liệu thực tế (con số cụ thể)
2. WHY: Giải thích nguyên nhân có thể
3. SO WHAT: Ý nghĩa và tác động đến doanh nghiệp
4. NOW WHAT: Gợi ý hành động cụ thể

QUY TẮC BẮT BUỘC:
1. Trả lời bằng tiếng Việt, chuyên nghiệp nhưng dễ hiểu
2. LUÔN dựa trên dữ liệu thực tế — TUYỆT ĐỐI KHÔNG bịa số liệu
3. Nếu không có dữ liệu, nói rõ "Chưa có dữ liệu cho khoảng thời gian này"
4. Format tiền VND (VD: 1.500.000 ₫ hoặc 1,5 tỷ ₫)
5. Khi phân tích, LUÔN đưa ra insight + cảnh báo + gợi ý hành động
6. So sánh với kỳ trước khi có dữ liệu
7. Khi "KẾT QUẢ TRUY VẤN CỤ THỂ" được cung cấp, ưu tiên dùng số liệu từ đó
8. Tổng hợp và phân tích — không chỉ lặp lại dữ liệu

ĐỊNH DẠNG TRẢ LỜI:
- Dùng **đậm** cho số liệu quan trọng
- Dùng bullet points cho danh sách
- Emoji phù hợp ở tiêu đề: 📊💰📈📉🧾👥🏭📦💵🔍⚠️✅❌🎯🔥📋
- Tối đa 500 từ, trọng tâm, insight-driven
- Kết thúc bằng 💡 Gợi ý hoặc ⚠️ Cảnh báo

BIỂU ĐỒ — RẤT QUAN TRỌNG:
Bạn CÓ THỂ và NÊN tạo biểu đồ để trực quan hóa dữ liệu. Thêm một hoặc NHIỀU block chart JSON ở cuối response.

Types biểu đồ:
- "bar": So sánh giữa các mục (top KH, so sánh tháng, breakdown)
- "line": Xu hướng theo thời gian (doanh thu, chi phí, lợi nhuận theo tháng)
- "pie": Phân bổ tỷ lệ (cơ cấu thuế, loại hóa đơn, thị phần KH)
- "area": Xu hướng với nhấn mạnh tích lũy (dòng tiền, growth)
- "composed": Nhiều metric cùng trục (DT + CP + LN trên cùng biểu đồ)

Format MỖI chart (có thể có NHIỀU block):
\`\`\`chart
{"type":"bar","data":[{"label":"T1","value":1000}],"xKey":"label","yKey":"value","label":"Tiêu đề biểu đồ"}
\`\`\`

Quy tắc chart:
- LUÔN thêm ít nhất 1 chart khi phân tích có số liệu
- Phân tích xu hướng → line/area chart
- So sánh top N → bar chart (ngang cho nhiều items)
- Phân bổ/tỷ lệ → pie chart  
- So sánh DT vs CP → composed chart với 2+ yKey
- Có thể tạo 2-3 charts cho phân tích toàn diện
- Đảm bảo data trong chart chính xác từ dữ liệu thực
- Cho composed chart, data có nhiều field, dùng yKey cho field chính, các field khác sẽ tự hiển thị`;


// ─── Build Financial Context (Enhanced) ─────────────────
/**
 * Query MongoDB to build a comprehensive financial context string.
 * Includes monthly stats, customers, suppliers, products, tax breakdown,
 * and recent invoices — so the LLM can answer virtually any question.
 */
async function buildFinancialContext(companyId) {
  const latestInvoice = await Invoice.findOne({ company_id: companyId })
    .sort({ invoiceDate: -1 })
    .select('invoiceDate')
    .lean();

  const now = latestInvoice?.invoiceDate ? new Date(latestInvoice.invoiceDate) : new Date();
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, 1));
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  // Parallel queries for maximum speed
  const [monthlyStats, topCustomers, topSuppliers, taxBreakdown, company, totalCounts, topProducts, recentInvoices] = await Promise.all([
    // Monthly revenue/expense stats (6 months)
    Invoice.aggregate([
      { $match: { company_id: companyId, invoiceDate: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { month: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } }, type: '$type' },
          total: { $sum: '$totalAmount' },
          tax: { $sum: '$taxAmount' },
          subtotal: { $sum: '$subtotal' },
          count: { $sum: 1 },
          avg: { $avg: '$totalAmount' },
          min: { $min: '$totalAmount' },
          max: { $max: '$totalAmount' },
        },
      },
      { $sort: { '_id.month': 1 } },
    ]),

    // Top 10 customers by revenue (YTD)
    Invoice.aggregate([
      { $match: { company_id: companyId, type: 'sale', invoiceDate: { $gte: yearStart } } },
      { $group: { _id: { name: '$buyer.name', taxCode: '$buyer.taxCode' }, total: { $sum: '$totalAmount' }, count: { $sum: 1 }, avg: { $avg: '$totalAmount' } } },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]),

    // Top 10 suppliers by expense (YTD)
    Invoice.aggregate([
      { $match: { company_id: companyId, type: 'purchase', invoiceDate: { $gte: yearStart } } },
      { $group: { _id: { name: '$seller.name', taxCode: '$seller.taxCode' }, total: { $sum: '$totalAmount' }, count: { $sum: 1 }, avg: { $avg: '$totalAmount' } } },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]),

    // Tax rate breakdown (YTD)
    InvoiceItem.aggregate([
      { $match: { company_id: companyId } },
      { $lookup: { from: 'invoices', localField: 'invoice_id', foreignField: '_id', as: 'inv' } },
      { $unwind: '$inv' },
      { $match: { 'inv.invoiceDate': { $gte: yearStart } } },
      {
        $group: {
          _id: { taxRate: '$taxRate', type: '$inv.type' },
          totalTax: { $sum: '$taxAmount' },
          totalPreTax: { $sum: '$preTaxAmount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalTax: -1 } },
    ]),

    // Company info
    Company.findById(companyId).select('companyName taxCode').lean(),

    // Total invoice counts
    Promise.all([
      Invoice.countDocuments({ company_id: companyId, type: 'sale' }),
      Invoice.countDocuments({ company_id: companyId, type: 'purchase' }),
    ]),

    // Top 10 products/services (YTD)
    InvoiceItem.aggregate([
      { $match: { company_id: companyId } },
      { $lookup: { from: 'invoices', localField: 'invoice_id', foreignField: '_id', as: 'inv' } },
      { $unwind: '$inv' },
      { $match: { 'inv.invoiceDate': { $gte: yearStart } } },
      { $group: { _id: { product: '$productName', type: '$inv.type' }, total: { $sum: '$preTaxAmount' }, qty: { $sum: '$quantity' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]),

    // 10 most recent invoices
    Invoice.find({ company_id: companyId })
      .sort({ invoiceDate: -1 })
      .limit(10)
      .select('invoiceNumber invoiceDate type totalAmount buyer.name seller.name status')
      .lean(),
  ]);

  // ── Build context string ──────────────────────────────
  let ctx = '';

  if (company) {
    ctx += `CÔNG TY: ${company.companyName} (MST: ${company.taxCode})\n`;
  }
  ctx += `Thời điểm hiện tại: ${now.toLocaleDateString('vi-VN')}\n`;
  ctx += `Tổng hóa đơn: ${totalCounts[0]} bán ra, ${totalCounts[1]} mua vào\n\n`;

  // ── Monthly stats ──
  ctx += '=== THỐNG KÊ THEO THÁNG (6 tháng gần nhất) ===\n';
  if (monthlyStats.length === 0) {
    ctx += 'Chưa có dữ liệu hóa đơn.\n';
  } else {
    const byMonth = {};
    monthlyStats.forEach(s => {
      const key = s._id.month;
      if (!byMonth[key]) byMonth[key] = {};
      byMonth[key][s._id.type] = { total: s.total, tax: s.tax, count: s.count, subtotal: s.subtotal, avg: s.avg };
    });
    Object.entries(byMonth).sort().forEach(([month, types]) => {
      const sale = types.sale || { total: 0, count: 0, tax: 0, subtotal: 0, avg: 0 };
      const purchase = types.purchase || { total: 0, count: 0, tax: 0, subtotal: 0, avg: 0 };
      const profit = sale.total - purchase.total;
      const margin = sale.total > 0 ? ((profit / sale.total) * 100).toFixed(1) : '0';
      ctx += `${month}: DT ${fmtVND(sale.total)} (${sale.count} HĐ, TB ${fmtVND(sale.avg)}) | CP ${fmtVND(purchase.total)} (${purchase.count} HĐ) | LN ${fmtVND(profit)} (${margin}%) | Thuế BR ${fmtVND(sale.tax)} MV ${fmtVND(purchase.tax)}\n`;
    });
  }

  // ── Top customers ──
  ctx += '\n=== TOP 10 KHÁCH HÀNG (năm nay) ===\n';
  if (topCustomers.length === 0) {
    ctx += 'Chưa có dữ liệu.\n';
  } else {
    const totalCustRevenue = topCustomers.reduce((s, c) => s + c.total, 0);
    topCustomers.forEach((c, i) => {
      const pct = ((c.total / totalCustRevenue) * 100).toFixed(1);
      ctx += `${i + 1}. ${c._id.name} (MST: ${c._id.taxCode || 'N/A'}): ${fmtVND(c.total)} (${pct}%) - ${c.count} HĐ - TB ${fmtVND(c.avg)}\n`;
    });
  }

  // ── Top suppliers ──
  ctx += '\n=== TOP 10 NHÀ CUNG CẤP (năm nay) ===\n';
  if (topSuppliers.length === 0) {
    ctx += 'Chưa có dữ liệu.\n';
  } else {
    topSuppliers.forEach((s, i) => {
      ctx += `${i + 1}. ${s._id.name} (MST: ${s._id.taxCode || 'N/A'}): ${fmtVND(s.total)} - ${s.count} HĐ - TB ${fmtVND(s.avg)}\n`;
    });
  }

  // ── Top products ──
  ctx += '\n=== TOP 10 SẢN PHẨM/DỊCH VỤ (năm nay) ===\n';
  if (topProducts.length === 0) {
    ctx += 'Chưa có dữ liệu.\n';
  } else {
    topProducts.forEach((p, i) => {
      const typeLabel = p._id.type === 'sale' ? 'Bán' : 'Mua';
      ctx += `${i + 1}. [${typeLabel}] ${p._id.product}: ${fmtVND(p.total)} - SL: ${p.qty} - ${p.count} lần\n`;
    });
  }

  // ── Tax breakdown ──
  ctx += '\n=== PHÂN BỔ THUẾ SUẤT (năm nay) ===\n';
  if (taxBreakdown.length === 0) {
    ctx += 'Chưa có dữ liệu.\n';
  } else {
    let totalSaleTax = 0, totalPurchaseTax = 0;
    taxBreakdown.forEach(t => {
      const typeLabel = t._id.type === 'sale' ? 'Bán ra' : 'Mua vào';
      ctx += `Thuế ${t._id.taxRate}% (${typeLabel}): ${fmtVND(t.totalTax)} trên ${fmtVND(t.totalPreTax)} (${t.count} dòng)\n`;
      if (t._id.type === 'sale') totalSaleTax += t.totalTax;
      else totalPurchaseTax += t.totalTax;
    });
    const netTax = totalSaleTax - totalPurchaseTax;
    ctx += `→ Thuế GTGT phải nộp (ước tính): ${fmtVND(Math.max(0, netTax))}`;
    if (netTax < 0) ctx += ` (được khấu trừ ${fmtVND(Math.abs(netTax))})`;
    ctx += '\n';
  }

  // ── Recent invoices ──
  ctx += '\n=== 10 HÓA ĐƠN GẦN NHẤT ===\n';
  if (recentInvoices.length === 0) {
    ctx += 'Chưa có dữ liệu.\n';
  } else {
    recentInvoices.forEach(inv => {
      const partner = inv.type === 'sale' ? inv.buyer?.name : inv.seller?.name;
      ctx += `#${inv.invoiceNumber} | ${inv.invoiceDate?.toLocaleDateString('vi-VN')} | ${inv.type === 'sale' ? 'Bán' : 'Mua'} | ${(partner || '').slice(0, 30)} | ${fmtVND(inv.totalAmount)} | ${inv.status}\n`;
    });
  }

  return ctx;
}

// ─── Chat History Context ───────────────────────────────
/**
 * Build conversation history for multi-turn awareness.
 * Takes the last N messages from the chat session.
 */
function buildChatHistory(messages, maxTurns = 6) {
  if (!messages || !messages.length) return [];
  const recent = messages.slice(-maxTurns * 2); // Last N pairs
  return recent.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));
}

// ─── Main RAG Generator ─────────────────────────────────
/**
 * Generate an LLM-enhanced response using OpenAI.
 *
 * @param {string} userMessage - The user's question
 * @param {ObjectId} companyId - Company ID for data context
 * @param {string|null} structuredData - Pre-queried data from queryEngine handlers
 * @param {Array|null} chatHistory - Previous messages for multi-turn context
 * @returns {{ text: string, chartData: object|null } | null} - null means fallback to rule-based
 */
async function generateResponse(userMessage, companyId, structuredData = null, chatHistory = null) {
  const apiKeys = getApiKeys();
  if (!apiKeys.length) return null;

  try {
    // Build financial context from DB
    const financialContext = await buildFinancialContext(companyId);

    // Combine contexts
    let contextBlock = financialContext;
    if (structuredData) {
      contextBlock += '\n\n=== KẾT QUẢ TRUY VẤN CỤ THỂ ===\n' + structuredData;
    }

    // Build messages array
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `[CONTEXT DỮ LIỆU CÔNG TY]\n${contextBlock}` },
    ];

    // Add chat history for multi-turn awareness
    if (chatHistory && chatHistory.length) {
      const history = buildChatHistory(chatHistory);
      messages.push(...history);
    }

    // Add current user message
    messages.push({ role: 'user', content: userMessage });

    const models = getModelChain();
    const rotatedKeys = rotateKeys(apiKeys);
    let response = '';
    let completed = false;
    const attemptErrors = [];

    for (const key of rotatedKeys) {
      const client = getClient(key);
      for (const model of models) {
        try {
          const completion = await client.chat.completions.create({
            model,
            messages,
            temperature: 0.5,
            max_tokens: 3000,
          });
          response = completion.choices[0]?.message?.content || '';
          completed = true;
          console.log(`[RAG] model=${model} key=${maskKey(key)} status=ok`);
          break;
        } catch (error) {
          const status = getStatusCode(error);
          attemptErrors.push({ model, key: maskKey(key), status, message: error?.message });
          console.warn(`[RAG] model=${model} key=${maskKey(key)} status=${status || 'error'} msg=${error?.message}`);
          if (!isRetryableError(error)) {
            // Keep moving across models for non-retryable model/key specific errors.
            continue;
          }
        }
      }
      if (completed) break;
    }

    if (!completed) {
      const reason = attemptErrors.map(e => `${e.model}/${e.key}:${e.status || 'error'}`).join(', ');
      throw new Error(`All Groq attempts failed (${reason || 'no-attempts'})`);
    }

    // Parse structured blocks for a stable assistant contract.
    const charts = parseJsonBlocks(response, 'chart');
    const mermaid = parseMermaidBlocks(response);
    const images = parseImageBlocks(response);
    const confidence = parseConfidence(response, structuredData ? 0.86 : 0.72);

    const markdown = response
      .replace(/```chart\n?[\s\S]*?```/g, '')
      .replace(/```mermaid\n?[\s\S]*?```/g, '')
      .replace(/```image\n?[\s\S]*?```/g, '')
      .replace(/```confidence\n?[\s\S]*?```/g, '')
      .trim();

    // Return single chart for backward compatibility, or array for multi-chart.
    const chartData = charts.length === 0 ? null : charts.length === 1 ? charts[0] : charts;

    return {
      text: markdown,
      chartData,
      responsePayload: {
        markdown,
        charts,
        mermaid,
        images,
        confidence,
      },
    };
  } catch (error) {
    console.error('RAG Service error:', error.message);
    return null; // Signal fallback to rule-based
  }
}

module.exports = {
  isAvailable,
  generateResponse,
  buildFinancialContext,
  getClient,
  getApiKeys,
};
