# FinTax AI Assistant Upgrade Plan

## Goal
Build a real assistant experience for web and Telegram with:
- Reliable data-grounded answers (no false zero outputs)
- Stronger model routing with multi-key failover
- Rich markdown output (headings, tables)
- Mermaid and generated image delivery
- Better dashboard visual depth

## Working Method
Each step must satisfy:
1. Scope implemented
2. Local validation run
3. Regression checks for client + server
4. Mark step complete

---

## Step 1 - Data Correctness First
Status: Completed

### Scope
- Replace weak default date logic with data-anchored date ranges
- Ensure unknown/unspecified time questions still hit real data windows
- Align RAG context range with latest invoice timestamp

### Deliverables
- Query engine smart default range helper
- Explicit-date detection guard
- RAG context anchor by latest invoice date

### Validation
- Server syntax check
- Type checks for affected consumers
- Manual smoke on chat endpoint (with sample prompts)

Result:
- Done: queryEngine and RAG now use data-anchored default windows
- Passed: backend syntax checks and frontend type-check

---

## Step 2 - Multi-Key LLM Routing + Better Models
Status: Completed

### Scope
- Add support for 2 Groq API keys with rotation and failover
- Add model tiering: primary, fallback, lightweight router
- Retry policy for rate-limit and transient provider failures

### Deliverables
- Config extensions in env loader
- Provider client pool in RAG service
- Request execution with key/model fallback chain
- Basic telemetry log fields: key index, model used, retries

### Validation
- Server syntax check
- Simulated failure fallback path test
- Real request with one key disabled (if keys available)

Result:
- Done: dual-key env config + key rotation + model fallback chain
- Passed: backend syntax checks
- Passed: live key smoke on both keys
- Passed: simulated failover (invalid key 1 -> key 2 success)

---

## Step 3 - Structured Assistant Output Contract
Status: Completed

### Scope
- Standardize response payload from backend to frontend:
  - markdown
  - charts[]
  - mermaid[]
  - images[]
  - confidence
- Keep backward compatibility with existing chartData field

### Deliverables
- Shared response schema on server
- Chat service typings update on client
- Safe parser with fallback for malformed blocks

### Validation
- Type check client
- API response contract smoke tests

Result:
- Done: backend trả về contract chuẩn gồm markdown, charts, mermaid, images, confidence
- Done: lưu responsePayload vào ChatHistory cho cả web và telegram
- Passed: backend runtime load checks
- Passed: frontend type-check

---

## Step 4 - Rich Markdown + Mermaid Rendering in Web
Status: Completed

### Scope
- Replace basic markdown splitter with full markdown renderer
- Render tables, headings, code blocks, lists
- Add Mermaid rendering blocks in chat messages

### Deliverables
- Chat UI renderer upgrade
- Mermaid component and sanitization rules
- Styling tokens for report-style readability

### Validation
- Client build
- Visual smoke tests with complex markdown + table + mermaid

Result:
- Done: thay renderer thủ công bằng markdown renderer đầy đủ (heading/table/code/list/link)
- Done: mermaid block renderer riêng, có fallback lỗi và lazy-load để giảm tải bundle ban đầu
- Done: hiển thị images[] và confidence từ response payload
- Passed: client type-check và production build

---

## Step 5 - Python Image Pipeline (Web + Telegram)
Status: Completed

### Scope
- Add Python worker/script to generate chart/report images (PNG)
- Backend executes image tasks and stores artifacts
- Web displays images inline
- Telegram sends images with captions

### Deliverables
- Python script(s) for chart generation
- Node orchestration service + storage path policy
- Telegram sendPhoto integration

### Validation
- Generate sample images from test payloads
- End-to-end: prompt -> image artifact -> web/telegram delivery

Result:
- Done: thêm Python worker tạo PNG từ chart payload (`python/generate_chart.py`)
- Done: thêm Node orchestration service (`src/services/image.service.js`) và static artifacts route
- Done: tích hợp auto-generate ảnh vào web chat payload và Telegram sendPhoto
- Done: bổ sung policy sinh ảnh theo intent/từ khóa + kênh (web/telegram), tránh spam ảnh không cần thiết
- Done: bổ sung artifact lifecycle (retention + max files/scope) và cleanup scheduler định kỳ
- Passed: backend syntax + runtime load checks
- Passed: python worker smoke tạo file PNG mẫu trong artifacts
- Passed: runtime smoke cho image policy + generation + cleanup

---

## Step 6 - Dashboard Expansion
Status: Completed

### Scope
- Add missing strategic charts:
  - Cashflow inflow/outflow/net
  - Margin trend
  - Customer concentration
  - Supplier dependency
  - Tax burden trend

### Deliverables
- Backend analytics endpoints or reuse existing with richer shape
- New chart components + layout tuning
- Empty-state and loading-state UX cleanup

### Validation
- Client build
- Dashboard smoke with seeded data

Progress:
- Done: thêm API `GET /api/analytics/strategic-metrics` trả về cashflow, margin trend, tax burden trend, customer concentration, supplier dependency
- Done: thêm panel dashboard mới hiển thị strategic signals (dòng tiền, biên lợi nhuận, gánh nặng thuế, concentration/dependency)
- Done: chuẩn hóa chuỗi dữ liệu theo tháng liên tục (fill missing months) để tránh gãy biểu đồ
- Done: thêm empty-state UX rõ ràng cho strategic panel và concentration/dependency blocks
- Passed: backend syntax checks cho analytics controller
- Passed: frontend type-check và production build

---

## Step 7 - Production Hardening + Acceptance Tests
Status: In Progress

### Scope
- Guardrails against hallucinated numeric claims
- Fallback messaging when data unavailable
- Add test prompts and expected checks

### Deliverables
- Prompt and post-processing guardrails
- Acceptance test checklist (VN financial prompts)
- Performance/cost sanity checks

### Validation
- End-to-end runbook
- Regression checks for web chat, telegram, dashboard

Progress:
- Done: thêm guardrail chống hallucination số liệu trong `queryEngine` (fallback về rule-based khi tín hiệu dữ liệu không khớp)
- Done: chuẩn hóa fallback message khi thiếu dữ liệu và hạ confidence cho response no-data
- Done: tạo checklist acceptance chi tiết tại `STEP7_ACCEPTANCE_CHECKLIST.md`
- Passed: backend syntax + diagnostics check cho `queryEngine`

---

## Execution Notes
- Sensitive keys must stay in environment variables only.
- Keep each step in isolated commits.
- Do not move to next step until validation passes.
