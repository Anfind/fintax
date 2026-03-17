const path = require('path');
const fs = require('fs/promises');
const { spawn } = require('child_process');
const env = require('../config/env');

const ARTIFACT_ROOT = path.join(__dirname, '../../artifacts/ai-images');
const PYTHON_SCRIPT = path.join(__dirname, '../../python/generate_chart.py');
const IMAGE_TRIGGER_KEYWORDS = /biểu đồ|chart|đồ thị|graph|plot|vẽ|sơ đồ|diagram|hình|image|png/i;
const TREND_INTENTS = new Set([
  'revenue_trend',
  'expense_trend',
  'profit_trend',
  'cashflow',
  'compare_months',
  'compare_quarters',
  'revenue_daily',
  'revenue_quarterly',
  'anomaly_detect',
]);

let cleanupTimer = null;

function sanitizeSegment(value) {
  return String(value || 'x').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 36) || 'x';
}

function pythonCommand() {
  return env.pythonCommand || 'python';
}

function publicBaseUrl() {
  return env.serverPublicUrl || `http://localhost:${env.port}`;
}

function normalizeToList(charts) {
  if (!charts) return [];
  return Array.isArray(charts) ? charts : [charts];
}

function safeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function shouldAutogenerateImages({ message, intent, charts, channel = 'web' }) {
  if (!env.aiImageAutogenEnabled) return false;

  const chartList = normalizeToList(charts).filter((item) => item && Array.isArray(item.data) && item.data.length);
  if (!chartList.length) return false;

  const text = String(message || '').trim();
  const hasVisualRequest = IMAGE_TRIGGER_KEYWORDS.test(text);
  const isTrendIntent = TREND_INTENTS.has(intent);

  if (hasVisualRequest || isTrendIntent) return true;

  // Telegram should avoid noise unless user asks visual output or intent is clearly trend-based.
  if (channel === 'telegram') return false;

  // Web can auto-generate for multi-chart payloads because users can inspect inline quickly.
  return chartList.length > 1;
}

async function invokePython(payload) {
  const tempInputPath = path.join(ARTIFACT_ROOT, `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
  await fs.mkdir(ARTIFACT_ROOT, { recursive: true });
  await fs.writeFile(tempInputPath, JSON.stringify(payload), 'utf-8');

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const proc = spawn(pythonCommand(), [PYTHON_SCRIPT, tempInputPath], { stdio: ['ignore', 'pipe', 'pipe'] });

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', async (code) => {
      try {
        await fs.unlink(tempInputPath);
      } catch {
        // Ignore temp cleanup issues.
      }

      if (code !== 0) {
        return reject(new Error(stderr || stdout || `Python worker exited with code ${code}`));
      }

      try {
        const parsed = JSON.parse(stdout.trim() || '{}');
        if (!parsed.ok) return reject(new Error(parsed.error || 'Unknown Python worker error'));
        return resolve(parsed);
      } catch {
        return reject(new Error(stdout || 'Failed to parse Python worker output'));
      }
    });
  });
}

async function generateChartImages({ companyId, charts }) {
  const chartList = normalizeToList(charts).filter((item) => item && Array.isArray(item.data) && item.data.length);
  if (!chartList.length) return [];

  const scopeDir = sanitizeSegment(companyId || 'global');
  const targetDir = path.join(ARTIFACT_ROOT, scopeDir);
  await fs.mkdir(targetDir, { recursive: true });

  const maxImages = Math.min(safeNumber(env.aiImageAutogenMaxImages, 2), chartList.length);
  const artifacts = [];

  for (let i = 0; i < maxImages; i += 1) {
    const chart = chartList[i];
    const fileName = `chart-${Date.now()}-${i + 1}.png`;
    const outputPath = path.join(targetDir, fileName);

    try {
      await invokePython({ chart, outputPath, title: chart.label || `Chart ${i + 1}` });
      artifacts.push({
        url: `${publicBaseUrl()}/artifacts/ai-images/${scopeDir}/${fileName}`,
        alt: chart.label || `Chart ${i + 1}`,
        caption: chart.label || 'Biểu đồ tự sinh bởi Python worker',
        mimeType: 'image/png',
      });
    } catch (error) {
      console.warn('[ImageService] generate failed:', error.message);
    }
  }

  return artifacts;
}

async function cleanupScope(scopePath, { nowMs, maxAgeMs, maxFilesPerScope }) {
  const entries = await fs.readdir(scopePath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const fullPath = path.join(scopePath, entry.name);
    const stat = await fs.stat(fullPath);
    files.push({ path: fullPath, name: entry.name, mtimeMs: stat.mtimeMs });
  }

  files.sort((a, b) => b.mtimeMs - a.mtimeMs);

  let deleted = 0;
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const expired = nowMs - file.mtimeMs > maxAgeMs;
    const exceedsCount = i >= maxFilesPerScope;

    if (expired || exceedsCount) {
      try {
        await fs.unlink(file.path);
        deleted += 1;
      } catch {
        // Ignore individual file cleanup issues.
      }
    }
  }

  return deleted;
}

async function cleanupArtifacts() {
  const maxAgeHours = safeNumber(env.aiImageRetentionHours, 72);
  const maxFilesPerScope = Math.max(10, safeNumber(env.aiImageMaxFilesPerScope, 200));
  const nowMs = Date.now();
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

  try {
    const scopes = await fs.readdir(ARTIFACT_ROOT, { withFileTypes: true });
    let totalDeleted = 0;

    for (const scope of scopes) {
      if (!scope.isDirectory()) continue;
      totalDeleted += await cleanupScope(path.join(ARTIFACT_ROOT, scope.name), {
        nowMs,
        maxAgeMs,
        maxFilesPerScope,
      });
    }

    return totalDeleted;
  } catch {
    return 0;
  }
}

function startArtifactCleanupScheduler() {
  if (cleanupTimer || !env.aiImageAutogenEnabled) return;

  const intervalMinutes = Math.max(5, safeNumber(env.aiImageCleanupIntervalMinutes, 30));
  cleanupTimer = setInterval(() => {
    cleanupArtifacts().catch((error) => {
      console.warn('[ImageService] cleanup failed:', error.message);
    });
  }, intervalMinutes * 60 * 1000);

  // Allow process to exit naturally in test/dev scripts.
  cleanupTimer.unref();
}

module.exports = {
  generateChartImages,
  shouldAutogenerateImages,
  cleanupArtifacts,
  startArtifactCleanupScheduler,
};
