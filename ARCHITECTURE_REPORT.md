# FinTax Platform — Architecture Report

## 1. Tổng quan hệ thống

**FinTax** là nền tảng phân tích tài chính & hóa đơn thuế, gồm 3 thành phần chính:

| Thành phần | Công nghệ | Mô tả |
|---|---|---|
| **Frontend** | React 19, Vite 8, TailwindCSS v4, Zustand, Recharts, Framer Motion | SPA dashboard + AI Chat |
| **Backend** | Node.js, Express 4, Mongoose 8, Socket.io 4 | REST API + WebSocket + AI Engine |
| **Database** | MongoDB Atlas (2 databases) | `fintax_web` (app) + `fintax_crawler` (raw) |

Ngoài ra có **Telegram Bot** (node-telegram-bot-api), **Python worker** (sinh biểu đồ PNG), và **Groq AI** (LLM cho RAG chat).

---

## 2. Database Schema

### 2.1 Company (Công ty)
Thực thể trung tâm, mỗi user và invoice đều thuộc về 1 company.

| Field | Type | Mô tả |
|---|---|---|
| `name` | String (required) | Tên công ty |
| `taxCode` | String (unique, required) | Mã số thuế — khóa duy nhất |
| `crawlerPassword` | String | Mật khẩu đăng nhập cổng thuế (crawler) |
| `telegramChatId` | String | Chat ID Telegram để gửi alert |
| `telegramEnabled` | Boolean (default: false) | Bật/tắt Telegram integration |
| `lastCrawlAt` | Date | Lần cuối crawl hóa đơn |

### 2.2 User (Người dùng)
Tài khoản người dùng, liên kết với company.

| Field | Type | Mô tả |
|---|---|---|
| `email` | String (unique, required) | Email đăng nhập |
| `password` | String (required) | Bcrypt hash |
| `name` | String (required) | Tên hiển thị |
| `role` | Enum: `admin`, `accountant`, `viewer` | Vai trò (default: viewer) |
| `company_id` | ObjectId → Company | Công ty thuộc về |

### 2.3 Invoice (Hóa đơn)
Model chính chứa dữ liệu hóa đơn mua/bán.

| Field | Type | Mô tả |
|---|---|---|
| `company_id` | ObjectId → Company (required) | Công ty sở hữu |
| `invoiceNumber` | String | Số hóa đơn |
| `invoiceDate` | Date (required) | Ngày hóa đơn |
| `type` | Enum: `sold`, `purchased` | Loại: bán ra / mua vào |
| `partnerName` | String | Tên đối tác |
| `partnerTaxCode` | String | MST đối tác |
| `totalBeforeTax` | Number (default: 0) | Tổng tiền trước thuế |
| `vatAmount` | Number (default: 0) | Tiền thuế VAT |
| `totalAmount` | Number (default: 0) | Tổng tiền sau thuế |
| `status` | Enum: `active`, `cancelled`, `replaced`, `adjusted` | Trạng thái |
| `source` | String (default: `crawl`) | Nguồn dữ liệu |
| `rawData` | Mixed | Dữ liệu thô gốc |

**Indexes**: `{ company_id, invoiceDate }`, `{ company_id, type, invoiceDate }`

### 2.4 InvoiceItem (Chi tiết hóa đơn)
Dòng chi tiết của mỗi hóa đơn.

| Field | Type | Mô tả |
|---|---|---|
| `invoice_id` | ObjectId → Invoice (required) | Hóa đơn cha |
| `company_id` | ObjectId → Company (required) | Công ty |
| `itemName` | String | Tên hàng hóa/dịch vụ |
| `unit` | String | Đơn vị tính |
| `quantity` | Number | Số lượng |
| `unitPrice` | Number | Đơn giá |
| `amount` | Number | Thành tiền |
| `vatRate` | Number | Thuế suất VAT (%) |
| `vatAmount` | Number | Tiền thuế |

### 2.5 ChatHistory (Lịch sử chat)
Lưu toàn bộ cuộc hội thoại của user.

| Field | Type | Mô tả |
|---|---|---|
| `company_id` | ObjectId → Company | Công ty |
| `user_id` | ObjectId → User | Người dùng |
| `source` | Enum: `web`, `telegram` | Kênh chat |
| `title` | String | Tiêu đề cuộc hội thoại |
| `messages` | Array of Message | Danh sách tin nhắn |

**Message sub-document**:

| Field | Type | Mô tả |
|---|---|---|
| `role` | Enum: `user`, `assistant` | Vai trò |
| `content` | String | Nội dung tin nhắn |
| `chartData` | Mixed | Dữ liệu biểu đồ (nếu có) |
| `responsePayload` | Mixed | Payload đầy đủ (markdown, charts, images, mermaid) |
| `timestamp` | Date | Thời điểm gửi |

### 2.6 CrawlJob (Lịch sử crawl)
Theo dõi trạng thái các lần crawl hóa đơn từ cổng thuế.

| Field | Type | Mô tả |
|---|---|---|
| `company_id` | ObjectId → Company (required) | Công ty |
| `status` | Enum: `pending`, `running`, `completed`, `failed` | Trạng thái |
| `type` | Enum: `sold`, `purchased`, `both` | Loại hóa đơn crawl |
| `fromDate`, `toDate` | Date | Khoảng thời gian |
| `totalInvoices` | Number | Tổng hóa đơn tìm thấy |
| `newInvoices` | Number | Hóa đơn mới |
| `error` | String | Lỗi nếu failed |

### 2.7 InvoiceAnalytics (Phân tích hóa đơn)
Bảng tổng hợp phân tích (pre-computed), dùng để tăng tốc dashboard.

| Field | Type | Mô tả |
|---|---|---|
| `company_id` | ObjectId → Company | Công ty |
| `period` | String | Kỳ phân tích (VD: `2025-Q1`) |
| `periodType` | Enum: `monthly`, `quarterly`, `yearly` | Loại kỳ |
| `metrics` | Object | Các chỉ số (revenue, expense, tax, profit…) |

### 2.8 Prediction (Dự báo)
Kết quả dự báo tài chính từ ML model.

| Field | Type | Mô tả |
|---|---|---|
| `company_id` | ObjectId → Company | Công ty |
| `type` | String | Loại dự báo (revenue, cash_flow…) |
| `period` | String | Kỳ dự báo |
| `predictedValue` | Number | Giá trị dự báo |
| `confidence` | Number | Độ tin cậy (0-1) |
| `actualValue` | Number | Giá trị thực (nếu có) |
| `modelVersion` | String | Phiên bản model |
| `factors` | Array | Yếu tố ảnh hưởng |

---

## 3. Flow: Từ Prompt đến Kết quả

### 3.1 Tổng quan flow

```
User nhập prompt (Web/Telegram)
        │
        ▼
┌─── Chat Controller ───┐
│  1. Tìm/tạo ChatSession│
│  2. Lưu user message   │
│  3. Gọi processQuery() │
└────────┬───────────────┘
         │
         ▼
┌─── Query Engine ──────────────────────────┐
│                                            │
│  ① detectIntent(message)                   │
│     → 30+ regex patterns tiếng Việt        │
│     → Xác định intent: revenue_trend,      │
│       top_customers, compare_months...      │
│                                            │
│  ② extractEntities(message)                │
│     → Tìm tên công ty, MST, số tiền...    │
│                                            │
│  ③ extractDateRange(message, anchorYear)   │
│     → Parse "tháng 1-6", "Q1 2025"...     │
│     → anchorYear = năm hóa đơn mới nhất   │
│                                            │
│  ④ Route đến handler theo intent           │
│     → handleRevenueTrend()                 │
│     → handleTopCustomers()                 │
│     → handleCompareMonths()                │
│     → ...29 handlers khác                  │
│                                            │
│  ⑤ Handler thực thi:                       │
│     a. MongoDB Aggregation Pipeline        │
│     b. Tính toán metrics                   │
│     c. Build chartData cho Recharts        │
│                                            │
│  ⑥ buildDeepContext()                      │
│     → Tổng hợp context từ DB results      │
│     → Format thành prompt cho LLM          │
│                                            │
│  ⑦ Gọi Groq AI (RAG)                      │
│     → System prompt + deep context         │
│     → Model: gpt-oss-120b (primary)       │
│     → Fallback: llama-3.3-70b-versatile   │
│                                            │
│  ⑧ normalizeResponse()                     │
│     → Parse markdown, charts, mermaid      │
│     → Áp dụng guardrails                   │
│     → Return responsePayload               │
└────────┬───────────────────────────────────┘
         │
         ▼
┌─── Image Service (tùy chọn) ──┐
│  shouldAutogenerateImages()?    │
│  → Kiểm tra keywords/intent    │
│  → Gọi Python worker           │
│  → Sinh biểu đồ PNG            │
│  → Lưu artifacts/ai-images/    │
└────────┬────────────────────────┘
         │
         ▼
┌─── Response ──────────────────┐
│  {                             │
│    markdown: "AI text...",     │
│    charts: [{data, label}],   │
│    mermaid: ["graph LR..."],  │
│    images: [{url, alt}],      │
│    confidence: 0.85            │
│  }                             │
└────────┬───────────────────────┘
         │
         ▼
┌─── Frontend Render ─────────────────┐
│  MarkdownRenderer → styled text      │
│  Recharts → interactive charts       │
│  MermaidDiagram → flowcharts         │
│  <img> → generated PNG images        │
└──────────────────────────────────────┘
```

### 3.2 Chi tiết Intent Detection

Query Engine sử dụng **30+ regex patterns** tiếng Việt để phân loại intent:

| Intent | Pattern ví dụ | Mô tả |
|---|---|---|
| `revenue_trend` | doanh thu, tổng bán | Xu hướng doanh thu theo thời gian |
| `expense_trend` | chi phí, tổng mua | Xu hướng chi phí theo thời gian |
| `profit_trend` | lợi nhuận, lãi lỗ | Phân tích lợi nhuận |
| `top_customers` | khách hàng lớn, top mua | Khách hàng mua nhiều nhất |
| `top_suppliers` | nhà cung cấp, top bán | Nhà cung cấp lớn nhất |
| `tax_summary` | thuế, VAT, tổng thuế | Tổng hợp thuế |
| `compare_months` | so sánh tháng | So sánh giữa các tháng |
| `anomaly_detect` | bất thường, anomaly | Phát hiện bất thường |
| `cashflow` | dòng tiền, cash flow | Phân tích dòng tiền |
| `invoice_detail` | hóa đơn số, chi tiết HĐ | Tra cứu hóa đơn cụ thể |
| `forecast` | dự báo, dự đoán | Dự báo tài chính |

### 3.3 Date Range Extraction

Hệ thống parse ngày tháng tiếng Việt với `anchorYear` = năm của hóa đơn mới nhất:

- `"tháng 1 đến tháng 6"` → Jan 1 – Jun 30 (của anchorYear)
- `"Q1 2025"` → Jan 1 – Mar 31, 2025
- `"nửa đầu năm"` → Jan 1 – Jun 30
- `"năm 2024"` → Jan 1 – Dec 31, 2024
- Không có ngày → `getSmartDefaultDateRange()` (6 tháng gần nhất có dữ liệu)

### 3.4 RAG Pipeline

1. **Rule-based handler** chạy trước → truy vấn MongoDB trực tiếp
2. **Deep context** được build từ kết quả DB (số liệu, top entities, trends)
3. **Groq AI** nhận system prompt + deep context + user message
4. **Guardrails**: kiểm tra hallucination, đảm bảo số liệu khớp DB
5. **Fallback**: nếu primary model fail → dùng fallback model

### 3.5 Image Generation Flow

```
shouldAutogenerateImages()
  ├── AI_IMAGE_AUTOGEN_ENABLED = true?
  ├── Có chartData với data array?
  ├── User yêu cầu visual? (regex: biểu đồ, chart, đồ thị...)
  └── Intent là trend-based?
        │
        ▼ (nếu tất cả thỏa)
  invokePython({chart, outputPath, title})
        │
        ▼
  Python worker (matplotlib/seaborn)
        │
        ▼
  artifacts/ai-images/{companyId}/chart-{timestamp}.png
        │
        ▼
  URL relative path → Frontend <img> render
```

---

## 4. API Endpoints

| Method | Path | Mô tả |
|---|---|---|
| POST | `/api/auth/register` | Đăng ký |
| POST | `/api/auth/login` | Đăng nhập |
| GET | `/api/auth/me` | Thông tin user hiện tại |
| GET | `/api/analytics/overview` | Tổng quan dashboard |
| GET | `/api/analytics/revenue-trend` | Xu hướng doanh thu |
| GET | `/api/analytics/top-customers` | Top khách hàng |
| GET | `/api/analytics/top-suppliers` | Top nhà cung cấp |
| GET | `/api/analytics/tax-distribution` | Phân bổ thuế |
| GET | `/api/analytics/invoice-status` | Trạng thái hóa đơn |
| GET | `/api/analytics/strategic-metrics` | Chỉ số chiến lược |
| GET | `/api/invoices` | Danh sách hóa đơn |
| GET | `/api/chat/history` | Lịch sử chat |
| GET | `/api/chat/:chatId` | Chi tiết cuộc chat |
| POST | `/api/chat/message` | Gửi tin nhắn AI |
| DELETE | `/api/chat/:chatId` | Xóa cuộc chat |
| POST | `/api/crawl/start` | Bắt đầu crawl |
| GET | `/api/crawl/status` | Trạng thái crawl |
| GET | `/api/predictions` | Danh sách dự báo |
| POST | `/api/telegram/webhook` | Telegram webhook |
| GET | `/api/health` | Health check |

---

## 5. Tech Stack tổng hợp

### Frontend
- React 19, React Router v7, Vite 8 (beta)
- TailwindCSS v4, Framer Motion v12
- Recharts 3.7, Mermaid 11
- Zustand 5 (state), Axios (HTTP), Socket.io-client 4

### Backend
- Node.js + Express 4
- MongoDB Atlas + Mongoose 8
- Socket.io 4 (real-time)
- Groq AI SDK (OpenAI-compatible)
- Python subprocess (chart generation)
- node-telegram-bot-api
- JWT + bcryptjs (auth)
- Helmet + express-rate-limit (security)
