require('dotenv').config();

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

module.exports = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI,
  dbName: process.env.DB_NAME || 'fintax_web',
  crawlerDbName: process.env.CRAWLER_DB_NAME || 'fintax_crawler',
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  crawlerApiUrl: process.env.CRAWLER_API_URL || 'http://localhost:5000',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  serverPublicUrl: process.env.SERVER_PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`,
  pythonCommand: process.env.PYTHON_COMMAND || 'python',
  aiImageAutogenEnabled: process.env.AI_IMAGE_AUTOGEN_ENABLED !== 'false',
  aiImageAutogenMaxImages: Math.max(1, toNumber(process.env.AI_IMAGE_AUTOGEN_MAX_IMAGES, 2)),
  aiImageRetentionHours: Math.max(1, toNumber(process.env.AI_IMAGE_RETENTION_HOURS, 72)),
  aiImageCleanupIntervalMinutes: Math.max(5, toNumber(process.env.AI_IMAGE_CLEANUP_INTERVAL_MINUTES, 30)),
  aiImageMaxFilesPerScope: Math.max(10, toNumber(process.env.AI_IMAGE_MAX_FILES_PER_SCOPE, 200)),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqApiKey2: process.env.GROQ_API_KEY_2 || '',
  groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  groqModelPrimary: process.env.GROQ_MODEL_PRIMARY || 'openai/gpt-oss-120b',
  groqModelFallback: process.env.GROQ_MODEL_FALLBACK || 'llama-3.3-70b-versatile',
  groqRouterModel: process.env.GROQ_ROUTER_MODEL || 'openai/gpt-oss-20b',
};
