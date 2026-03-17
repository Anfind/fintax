# Step 7 Acceptance Checklist (Web + Telegram + Dashboard)

## 1) Data Availability Guardrails

- Prompt: `Doanh thu tháng 01/2035 là bao nhiêu?`
  - Expected: assistant states no data, does not invent numeric totals.
  - Expected payload: `responsePayload.charts` empty when no data.
- Prompt: `Top khách hàng tháng không có dữ liệu`
  - Expected: no-data fallback message appears.
  - Expected: confidence <= 0.6.

## 2) Numeric Claim Reliability

- Prompt: `Doanh thu và chi phí 6 tháng gần nhất, cho biểu đồ`
  - Expected: numeric claims align with backend aggregates.
  - Expected: charts generated only when requested or trend intent.
- Prompt: `So sánh doanh thu quý 1 và quý 2 năm 2025`
  - Expected: comparison values are traceable to invoice aggregates.

## 3) Rich Response Contract

- Verify API response includes:
  - `responsePayload.markdown`
  - `responsePayload.charts[]`
  - `responsePayload.mermaid[]`
  - `responsePayload.images[]`
  - `responsePayload.confidence`
- Verify backward compatibility field `chartData` still present.

## 4) Image Pipeline Safety

- Prompt with trend/chart intent:
  - Expected: `images[]` may be generated from chart payload.
- Prompt without visual intent in Telegram:
  - Expected: avoid unnecessary image generation.
- Verify retention cleanup:
  - Old artifacts are removed by scheduler based on retention config.

## 5) Web Chat Rendering

- Test markdown features: heading, table, list, code block.
- Test mermaid block rendering with valid and invalid diagrams.
- Expected invalid diagram behavior: graceful fallback message, no crash.

## 6) Telegram Delivery

- Linked group sends finance prompt.
- Expected: markdown response delivered.
- If images exist: up to 2 photos sent with caption.
- If image send fails: text response still delivered.

## 7) Dashboard Strategic Metrics

- Verify strategic panel loads:
  - Cashflow inflow/outflow/net
  - Margin trend
  - Tax burden trend
  - Customer concentration
  - Supplier dependency
- Empty date range behavior:
  - clear empty-state message shown
  - no chart crash

## 8) Cost / Performance Sanity

- Verify Groq key/model failover logs show retry path when needed.
- Verify no tight retry loops under provider rate limit.
- Verify client build warning is monitored (chunk size), but app remains functional.

## 9) Regression Smoke

- Web login -> dashboard -> chat -> settings pages all load.
- `/api/health` returns `status: ok` and db status field.
- No new syntax/type errors in changed files.
