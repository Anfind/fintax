const router = require('express').Router();
const ctrl = require('../controllers/chat.controller');
const { auth } = require('../middleware/auth.middleware');

router.use(auth);

router.get('/history', ctrl.getChatHistory);
router.get('/:chatId', ctrl.getChatById);
router.post('/message', ctrl.sendMessage);
router.delete('/:chatId', ctrl.deleteChat);

module.exports = router;
