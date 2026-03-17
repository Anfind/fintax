const router = require('express').Router();
const ctrl = require('../controllers/crawl.controller');
const { auth, requireRole } = require('../middleware/auth.middleware');

router.use(auth);

router.get('/captcha', ctrl.getCaptcha);
router.post('/login', ctrl.loginCrawler);
router.post('/start', requireRole('admin', 'accountant'), ctrl.startCrawl);
router.get('/history', ctrl.getCrawlHistory);

module.exports = router;
