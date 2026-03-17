# FinTax — Hướng dẫn Deploy

## Kiến trúc Deploy

```
┌─────────────────┐      API calls       ┌─────────────────┐
│   Vercel         │ ──────────────────►  │   Render         │
│   (Frontend)     │                      │   (Backend)      │
│   React SPA      │ ◄──────────────────  │   Node.js API    │
└─────────────────┘      JSON + WS        └────────┬────────┘
                                                    │
                                                    ▼
                                          ┌─────────────────┐
                                          │  MongoDB Atlas   │
                                          │  (Cloud DB)      │
                                          └─────────────────┘
```

---

## 1. Deploy Backend lên Render

### Bước 1: Tạo repository riêng cho server (hoặc mono-repo)

Nếu dùng mono-repo, set **Root Directory** = `fintax-server` trong Render dashboard.

### Bước 2: Tạo Web Service trên Render

1. Truy cập [dashboard.render.com](https://dashboard.render.com)
2. **New > Web Service**
3. Kết nối GitHub repo
4. Cấu hình:
   - **Name**: `fintax-api`
   - **Region**: Singapore (gần nhất)
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node src/app.js`
   - **Plan**: Free (hoặc Starter $7/tháng để không bị sleep)

### Bước 3: Thiết lập Environment Variables

Vào **Environment** tab, thêm các biến sau:

| Key | Value | Ghi chú |
|---|---|---|
| `NODE_ENV` | `production` | |
| `PORT` | `3001` | Render tự gán, nhưng nên set |
| `MONGODB_URI` | `mongodb+srv://...` | Connection string MongoDB Atlas |
| `DB_NAME` | `fintax_web` | |
| `CRAWLER_DB_NAME` | `fintax_crawler` | |
| `JWT_SECRET` | `<random-string-32+chars>` | Tạo mới, KHÔNG dùng dev secret |
| `CLIENT_URL` | `https://fintax-client.vercel.app` | Domain Vercel frontend |
| `SERVER_PUBLIC_URL` | `https://fintax-api.onrender.com` | Domain Render (tự thay) |
| `GROQ_API_KEY` | `gsk_...` | API key Groq |
| `GROQ_API_KEY_2` | `gsk_...` | Backup key |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | |
| `GROQ_MODEL_PRIMARY` | `openai/gpt-oss-120b` | |
| `GROQ_MODEL_FALLBACK` | `llama-3.3-70b-versatile` | |
| `GROQ_ROUTER_MODEL` | `openai/gpt-oss-20b` | |
| `TELEGRAM_BOT_TOKEN` | `<token>` | Nếu dùng Telegram bot |
| `AI_IMAGE_AUTOGEN_ENABLED` | `false` | Tắt trên free tier (không có Python) |
| `PYTHON_COMMAND` | `python3` | |

### Bước 4: Deploy

Render sẽ tự động build và deploy khi push code. Kiểm tra:
```
https://fintax-api.onrender.com/api/health
```

**Lưu ý Render Free Tier**:
- Service sẽ **sleep sau 15 phút** không có request → request đầu tiên mất ~30s để wake up
- Nâng lên Starter ($7/tháng) để service luôn active

---

## 2. Deploy Frontend lên Vercel

### Bước 1: Import project

1. Truy cập [vercel.com/dashboard](https://vercel.com/dashboard)
2. **Add New > Project**
3. Import từ GitHub repo
4. Nếu mono-repo, set **Root Directory** = `fintax-client`

### Bước 2: Cấu hình Build

Vercel sẽ tự phát hiện Vite. Kiểm tra:
- **Framework Preset**: Vite
- **Build Command**: `npm run build` (hoặc `tsc -b && vite build`)
- **Output Directory**: `dist`

### Bước 3: Thiết lập Environment Variables

Vào **Settings > Environment Variables**:

| Key | Value | Ghi chú |
|---|---|---|
| `VITE_API_URL` | `https://fintax-api.onrender.com/api` | URL backend API |
| `VITE_WS_URL` | `https://fintax-api.onrender.com` | URL WebSocket (không có /api) |

**Quan trọng**: Biến `VITE_` prefix bắt buộc để Vite inject vào client build.

### Bước 4: Deploy

Vercel tự deploy khi push. Kiểm tra domain:
```
https://fintax-client.vercel.app
```

### Bước 5: Cập nhật CLIENT_URL trên Render

Sau khi có domain Vercel chính thức, quay lại Render và cập nhật:
```
CLIENT_URL=https://fintax-client.vercel.app
```

Nếu muốn hỗ trợ cả Vercel preview URLs (mỗi PR tạo preview riêng):
```
CLIENT_URL=https://fintax-client.vercel.app,https://fintax-client-*.vercel.app
```

---

## 3. Cập nhật MongoDB Atlas Network Access

MongoDB Atlas mặc định chặn IP không được phép. Cần whitelist:

1. Vào [cloud.mongodb.com](https://cloud.mongodb.com)
2. **Network Access > Add IP Address**
3. Chọn **Allow Access from Anywhere** (`0.0.0.0/0`) — cần thiết vì Render IP thay đổi
4. Hoặc thêm Render static IP nếu dùng paid plan

---

## 4. Checklist sau Deploy

- [ ] Backend health check: `https://<render-domain>/api/health` → `{"status":"ok","db":"connected"}`
- [ ] Frontend load: `https://<vercel-domain>` → Trang login hiển thị
- [ ] Đăng nhập thành công
- [ ] Dashboard hiển thị biểu đồ (nếu có dữ liệu)
- [ ] AI Chat phản hồi đúng
- [ ] Telegram bot hoạt động (nếu cấu hình)

---

## 5. Custom Domain (Tùy chọn)

### Vercel
1. **Settings > Domains > Add**
2. Thêm domain `app.fintax.vn`
3. Cập nhật DNS CNAME → `cname.vercel-dns.com`

### Render
1. **Settings > Custom Domains > Add**
2. Thêm domain `api.fintax.vn`
3. Cập nhật DNS theo hướng dẫn Render

Sau khi đổi domain, nhớ cập nhật:
- `CLIENT_URL` trên Render = domain Vercel mới
- `VITE_API_URL` trên Vercel = domain Render mới
- `SERVER_PUBLIC_URL` trên Render = domain Render mới
