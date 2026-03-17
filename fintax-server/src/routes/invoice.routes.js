const router = require('express').Router();
const ctrl = require('../controllers/invoice.controller');
const { auth } = require('../middleware/auth.middleware');
const { syncInvoices } = require('../services/sync.service');
const Company = require('../models/Company');

router.use(auth);

router.get('/', ctrl.getInvoices);
router.get('/export-csv', ctrl.exportCSV);
router.get('/:id', ctrl.getInvoiceById);

// POST /api/invoices/sync - trigger sync from crawler DB
router.post('/sync', async (req, res, next) => {
  try {
    const company = await Company.findById(req.user.company_id);
    if (!company) return res.status(400).json({ error: 'Chưa liên kết công ty' });

    const result = await syncInvoices(company.taxCode);
    res.json({ message: 'Sync thành công', ...result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
