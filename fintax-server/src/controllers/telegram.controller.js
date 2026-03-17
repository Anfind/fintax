const Company = require('../models/Company');

// GET /api/telegram/settings
exports.getSettings = async (req, res, next) => {
  try {
    const company = await Company.findById(req.user.company_id).select(
      'telegramGroupId telegramBotToken companyName taxCode'
    );
    if (!company) return res.status(404).json({ error: 'Company not found' });

    res.json({
      data: {
        telegramGroupId: company.telegramGroupId,
        hasBotToken: !!company.telegramBotToken,
        companyName: company.companyName,
        taxCode: company.taxCode,
      },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/telegram/settings
exports.updateSettings = async (req, res, next) => {
  try {
    const { telegramGroupId } = req.body;

    const company = await Company.findById(req.user.company_id);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    if (telegramGroupId !== undefined) company.telegramGroupId = telegramGroupId || null;

    await company.save();
    res.json({ message: 'Cập nhật thành công', data: { telegramGroupId: company.telegramGroupId } });
  } catch (error) {
    next(error);
  }
};

// POST /api/telegram/test
exports.testConnection = async (req, res, next) => {
  try {
    const { sendNotification } = require('../services/telegram.service');
    const company = await Company.findById(req.user.company_id);
    if (!company?.telegramGroupId) {
      return res.status(400).json({ error: 'Chưa liên kết group Telegram' });
    }

    await sendNotification(
      req.user.company_id,
      `✅ *Test kết nối thành công!*\n\nFinTax Bot đã liên kết với *${company.companyName}*.`
    );
    res.json({ message: 'Đã gửi tin nhắn test' });
  } catch (error) {
    next(error);
  }
};
