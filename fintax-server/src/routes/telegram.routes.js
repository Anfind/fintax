const router = require('express').Router();
const { auth } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/telegram.controller');

router.use(auth);

router.get('/settings', ctrl.getSettings);
router.put('/settings', ctrl.updateSettings);
router.post('/test', ctrl.testConnection);

module.exports = router;
