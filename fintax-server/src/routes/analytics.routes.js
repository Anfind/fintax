const router = require('express').Router();
const ctrl = require('../controllers/analytics.controller');
const { auth } = require('../middleware/auth.middleware');

router.use(auth);

router.get('/overview', ctrl.getOverview);
router.get('/revenue-trend', ctrl.getRevenueTrend);
router.get('/top-customers', ctrl.getTopCustomers);
router.get('/top-suppliers', ctrl.getTopSuppliers);
router.get('/tax-distribution', ctrl.getTaxDistribution);
router.get('/invoice-status', ctrl.getInvoiceStatus);
router.get('/strategic-metrics', ctrl.getStrategicMetrics);

module.exports = router;
