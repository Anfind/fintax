const router = require('express').Router();
const { auth } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/prediction.controller');

router.use(auth);

router.get('/revenue', ctrl.getRevenueForecast);
router.get('/expense', ctrl.getExpenseForecast);
router.get('/anomalies', ctrl.getAnomalies);
router.get('/summary', ctrl.getPredictionSummary);

module.exports = router;
