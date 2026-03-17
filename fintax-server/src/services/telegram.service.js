/**
 * Telegram Bot Service
 * Listens for messages in linked Telegram groups/chats,
 * routes them through the shared queryEngine, and replies.
 */
const TelegramBot = require('node-telegram-bot-api');
const Company = require('../models/Company');
const ChatHistory = require('../models/ChatHistory');
const { processQuery, HELP_TEXT } = require('./queryEngine');
const { generateChartImages, shouldAutogenerateImages } = require('./image.service');

let botInstance = null;

/**
 * Start the Telegram bot if a token is configured.
 * Called once from app.js after DB connection.
 */
const startBot = async () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('   Telegram:    disabled (no TELEGRAM_BOT_TOKEN)');
    return null;
  }

  try {
    botInstance = new TelegramBot(token, { polling: true });
    console.log('   Telegram:    enabled (polling)');

    // ─── /start ─────────────────────────────────
    botInstance.onText(/\/start/, (msg) => {
      botInstance.sendMessage(
        msg.chat.id,
        '🤖 *FinTax Bot* — Trợ lý tài chính thông minh.\n\n' +
          'Gửi `/link <mã_số_thuế>` để liên kết group này với công ty.\n' +
          'Sau đó hỏi bất kỳ câu hỏi tài chính nào!\n\n' +
          'Gõ `/help` để xem danh sách lệnh.',
        { parse_mode: 'Markdown' }
      );
    });

    // ─── /help ──────────────────────────────────
    botInstance.onText(/\/help/, (msg) => {
      const text = HELP_TEXT.replace(/\*\*(.*?)\*\*/g, '*$1*'); // Convert to TG markdown
      botInstance.sendMessage(msg.chat.id, `🧠 *Hướng dẫn sử dụng*\n\n${text}`, {
        parse_mode: 'Markdown',
      });
    });

    // ─── /link <taxCode> ────────────────────────
    botInstance.onText(/\/link\s+(\S+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const taxCode = match[1];

      try {
        const company = await Company.findOne({ taxCode });
        if (!company) {
          return botInstance.sendMessage(chatId, '❌ Không tìm thấy công ty với mã số thuế này.');
        }

        company.telegramGroupId = String(chatId);
        await company.save();

        botInstance.sendMessage(
          chatId,
          `✅ Đã liên kết group này với *${company.companyName}* (${company.taxCode}).\n\nBây giờ bạn có thể hỏi về dữ liệu tài chính!`,
          { parse_mode: 'Markdown' }
        );
      } catch (err) {
        console.error('Telegram /link error:', err.message);
        botInstance.sendMessage(chatId, '❌ Lỗi khi liên kết. Vui lòng thử lại.');
      }
    });

    // ─── /unlink ────────────────────────────────
    botInstance.onText(/\/unlink/, async (msg) => {
      const chatId = String(msg.chat.id);
      try {
        const company = await Company.findOne({ telegramGroupId: chatId });
        if (!company) {
          return botInstance.sendMessage(msg.chat.id, 'Group này chưa liên kết với công ty nào.');
        }
        company.telegramGroupId = null;
        await company.save();
        botInstance.sendMessage(msg.chat.id, '✅ Đã hủy liên kết.');
      } catch (err) {
        botInstance.sendMessage(msg.chat.id, '❌ Lỗi: ' + err.message);
      }
    });

    // ─── /status ────────────────────────────────
    botInstance.onText(/\/status/, async (msg) => {
      const chatId = String(msg.chat.id);
      try {
        const company = await Company.findOne({ telegramGroupId: chatId });
        if (!company) {
          return botInstance.sendMessage(msg.chat.id, '❓ Group chưa liên kết. Gửi `/link <mã_số_thuế>`.', {
            parse_mode: 'Markdown',
          });
        }
        botInstance.sendMessage(
          msg.chat.id,
          `📋 *Trạng thái*\n\n- Công ty: *${company.companyName}*\n- MST: \`${company.taxCode}\`\n- Group ID: \`${chatId}\``,
          { parse_mode: 'Markdown' }
        );
      } catch (err) {
        botInstance.sendMessage(msg.chat.id, '❌ Lỗi: ' + err.message);
      }
    });

    // ─── General messages (data queries) ────────
    botInstance.on('message', async (msg) => {
      // Skip commands
      if (!msg.text || msg.text.startsWith('/')) return;

      const chatId = String(msg.chat.id);
      const telegramUserId = String(msg.from.id);

      try {
        // Find linked company
        const company = await Company.findOne({ telegramGroupId: chatId });
        if (!company) {
          return botInstance.sendMessage(
            msg.chat.id,
            '⚠️ Group chưa liên kết. Gửi `/link <mã_số_thuế>` trước.',
            { parse_mode: 'Markdown' }
          );
        }

        // Load recent chat history for multi-turn RAG context
        let chatHistory = await ChatHistory.findOne({
          company_id: company._id,
          source: 'telegram',
          telegramUserId,
        }).sort({ updatedAt: -1 });

        const existingMessages = chatHistory && (Date.now() - chatHistory.updatedAt < 30 * 60 * 1000)
          ? chatHistory.messages
          : [];

        // Process query with chat history context
        const result = await processQuery(msg.text, company._id, existingMessages);

        const responsePayload = result.responsePayload || {
          markdown: result.text,
          charts: Array.isArray(result.chartData) ? result.chartData : result.chartData ? [result.chartData] : [],
          mermaid: [],
          images: [],
          confidence: 0.75,
        };

        if (!responsePayload.images?.length && shouldAutogenerateImages({
          message: msg.text,
          intent: result.intent,
          charts: responsePayload.charts,
          channel: 'telegram',
        })) {
          const generated = await generateChartImages({
            companyId: String(company._id),
            charts: responsePayload.charts,
          });
          if (generated.length) responsePayload.images = generated;
        }

        // Convert **bold** → *bold* for Telegram Markdown
        const tgText = (responsePayload.markdown || result.text).replace(/\*\*(.*?)\*\*/g, '*$1*');

        await botInstance.sendMessage(msg.chat.id, tgText, { parse_mode: 'Markdown' });

        if (responsePayload.images?.length) {
          for (const image of responsePayload.images.slice(0, 2)) {
            try {
              await botInstance.sendPhoto(msg.chat.id, image.url, {
                caption: image.caption || image.alt || 'Biểu đồ tự sinh',
              });
            } catch (photoErr) {
              console.warn('Telegram sendPhoto failed:', photoErr.message);
            }
          }
        }

        // Save to chat history
        if (!chatHistory || Date.now() - chatHistory.updatedAt > 30 * 60 * 1000) {
          // New session if no recent chat (30 min timeout)
          chatHistory = new ChatHistory({
            company_id: company._id,
            source: 'telegram',
            telegramUserId,
            title: msg.text.slice(0, 60),
            messages: [],
          });
        }

        chatHistory.messages.push(
          { role: 'user', content: msg.text, timestamp: new Date() },
          {
            role: 'assistant',
            content: responsePayload.markdown || result.text,
            chartData: result.chartData || null,
            responsePayload: responsePayload || null,
            timestamp: new Date(),
          }
        );
        await chatHistory.save();
      } catch (err) {
        console.error('Telegram message error:', err.message);
        botInstance.sendMessage(msg.chat.id, '❌ Đã xảy ra lỗi khi xử lý yêu cầu.');
      }
    });

    // Error handling
    botInstance.on('polling_error', (err) => {
      console.error('Telegram polling error:', err.code, err.message);
    });

    return botInstance;
  } catch (err) {
    console.error('Failed to start Telegram bot:', err.message);
    return null;
  }
};

/**
 * Stop the bot (for graceful shutdown).
 */
const stopBot = () => {
  if (botInstance) {
    botInstance.stopPolling();
    botInstance = null;
  }
};

/**
 * Send a notification message to a company's Telegram group.
 * @param {string} companyId
 * @param {string} text  Markdown text
 */
const sendNotification = async (companyId, text) => {
  if (!botInstance) return;
  try {
    const company = await Company.findById(companyId);
    if (!company?.telegramGroupId) return;
    await botInstance.sendMessage(company.telegramGroupId, text, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Telegram notification error:', err.message);
  }
};

module.exports = { startBot, stopBot, sendNotification };
