const axios = require('axios');
const env = require('../config/env');
const CrawlJob = require('../models/CrawlJob');
const Company = require('../models/Company');
const { syncInvoices } = require('../services/sync.service');
const { sendNotification } = require('../services/telegram.service');

const crawlerApi = axios.create({ baseURL: env.crawlerApiUrl, timeout: 120000 });

// GET /api/crawl/captcha
exports.getCaptcha = async (req, res, next) => {
  try {
    const response = await crawlerApi.get('/api/get-captcha');
    res.json(response.data);
  } catch (error) {
    next(new Error('Không thể lấy captcha từ crawler: ' + error.message));
  }
};

// POST /api/crawl/login
exports.loginCrawler = async (req, res, next) => {
  try {
    const { username, password, captcha } = req.body;
    const response = await crawlerApi.post('/api/login', { username, password, captcha });
    res.json(response.data);
  } catch (error) {
    next(new Error('Đăng nhập crawler thất bại: ' + (error.response?.data?.error || error.message)));
  }
};

// POST /api/crawl/start
exports.startCrawl = async (req, res, next) => {
  let job;
  try {
    const { startDate, endDate, invoiceType } = req.body;

    // Map frontend values to crawler API params
    const loai_hd = invoiceType === 'sold' ? '1' : invoiceType === 'purchased' ? '2' : '0';
    const loai_xl = '1'; // chitiet by default

    // Create crawl job record
    job = await CrawlJob.create({
      company_id: req.user.company_id,
      triggeredBy: req.user._id,
      type: invoiceType === 'sold' ? 'sale' : invoiceType === 'purchased' ? 'purchase' : 'both',
      processType: 'chitiet',
      dateRange: { start: startDate, end: endDate },
      status: 'running',
      startedAt: new Date(),
    });

    // Call crawler API
    const response = await crawlerApi.post('/api/process-invoices', {
      loai_hd,
      tu_ngay: startDate,
      den_ngay: endDate,
      loai_xl,
    });

    job.status = 'completed';
    job.completedAt = new Date();
    job.progress = 100;
    job.result = {
      invoicesFound: response.data.total || 0,
      invoicesSaved: response.data.saved || 0,
      message: response.data.message || 'Hoàn thành',
    };
    await job.save();

    // Auto-sync crawler data → web DB
    let syncResult = null;
    try {
      const company = await Company.findById(req.user.company_id);
      if (company) {
        syncResult = await syncInvoices(company.taxCode);
      }
    } catch (syncErr) {
      console.error('Auto-sync failed after crawl:', syncErr.message);
    }

    // Emit via Socket.io if available
    const io = req.app.get('io');
    if (io) {
      io.to(`company:${req.user.company_id}`).emit('crawl:completed', {
        jobId: job._id,
        result: job.result,
        syncResult,
      });
    }

    // Send Telegram notification
    sendNotification(
      req.user.company_id,
      `✅ *Crawl hoàn tất!*\n\n` +
        `📅 ${startDate} → ${endDate}\n` +
        `📄 ${job.result.invoicesFound || 0} hóa đơn tìm thấy\n` +
        `🔄 ${syncResult?.totalSynced || 0} hóa đơn đồng bộ`
    ).catch(() => {});

    res.json({ data: { jobId: job._id, ...job.toObject(), syncResult }, crawlerResult: response.data });
  } catch (error) {
    // Mark job as failed if it was created
    if (job) {
      job.status = 'failed';
      job.error = error.response?.data?.error || error.message;
      job.completedAt = new Date();
      await job.save().catch(() => {});
    }
    next(new Error('Crawl thất bại: ' + (error.response?.data?.error || error.message)));
  }
};

// GET /api/crawl/history
exports.getCrawlHistory = async (req, res, next) => {
  try {
    const jobs = await CrawlJob.find({ company_id: req.user.company_id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('triggeredBy', 'fullName email')
      .lean();
    res.json({ data: jobs });
  } catch (error) {
    next(error);
  }
};
