const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const path = require('path');

const env = require('./config/env');
const { connectDB } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/auth.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const invoiceRoutes = require('./routes/invoice.routes');
const crawlRoutes = require('./routes/crawl.routes');
const chatRoutes = require('./routes/chat.routes');
const telegramRoutes = require('./routes/telegram.routes');
const predictionRoutes = require('./routes/prediction.routes');
const { startArtifactCleanupScheduler } = require('./services/image.service');

const app = express();
const server = http.createServer(app);

// ─── CORS origins (supports comma-separated CLIENT_URL) ─
const allowedOrigins = env.clientUrl
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOrigin = allowedOrigins.length === 1
  ? allowedOrigins[0]
  : allowedOrigins;

// ─── Socket.io ──────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: corsOrigin, credentials: true },
});
app.set('io', io);

io.on('connection', (socket) => {
  // Join company room for targeted events
  socket.on('join:company', (companyId) => {
    if (companyId) socket.join(`company:${companyId}`);
  });
});

// ─── Middleware ──────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));
app.use('/artifacts', express.static(path.join(__dirname, '../artifacts')));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use('/api/', limiter);

// ─── Routes ─────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/crawl', crawlRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/predictions', predictionRoutes);

// Health check
const mongoose = require('mongoose');
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';
  res.json({ status: 'ok', time: new Date().toISOString(), db: dbStatus });
});

// ─── Error Handler ──────────────────────────────────────
app.use(errorHandler);

// ─── Start ──────────────────────────────────────────────
const start = async () => {
  // Listen FIRST so Render detects the port immediately
  server.listen(env.port, '0.0.0.0', () => {
    console.log(`\n🚀 FinTax API running on 0.0.0.0:${env.port}`);
    console.log(`   Environment: ${env.nodeEnv}`);
    console.log(`   Socket.io:   enabled`);
    console.log(`   Client URL:  ${allowedOrigins.join(', ')}\n`);
  });

  // Connect DB after server is already listening
  try {
    await connectDB();
  } catch (err) {
    console.error('⚠ Database connection failed:', err.message);
  }

  // Start Telegram bot (non-blocking)
  const { startBot } = require('./services/telegram.service');
  startBot().catch((err) => console.error('Telegram bot error:', err.message));

  // Start periodic cleanup for generated AI image artifacts.
  startArtifactCleanupScheduler();
};

start();

module.exports = app;
