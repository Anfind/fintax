const ChatHistory = require('../models/ChatHistory');
const { processQuery } = require('../services/queryEngine');
const { generateChartImages, shouldAutogenerateImages } = require('../services/image.service');

/**
 * Web Chat controller — uses shared queryEngine service.
 */

// ─── Controllers ────────────────────────────────────────

// GET /api/chat/history
exports.getChatHistory = async (req, res, next) => {
  try {
    const chats = await ChatHistory.find({
      company_id: req.user.company_id,
      user_id: req.user._id,
      source: 'web',
    })
      .select('title messages.role messages.content createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    // Return with last message preview
    const data = chats.map((c) => ({
      _id: c._id,
      title: c.title,
      lastMessage: c.messages?.[c.messages.length - 1]?.content?.slice(0, 100) || '',
      messageCount: c.messages?.length || 0,
      updatedAt: c.updatedAt,
    }));

    res.json({ data });
  } catch (error) {
    next(error);
  }
};

// GET /api/chat/:chatId
exports.getChatById = async (req, res, next) => {
  try {
    const chat = await ChatHistory.findOne({
      _id: req.params.chatId,
      company_id: req.user.company_id,
      user_id: req.user._id,
    }).lean();

    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json({ data: chat });
  } catch (error) {
    next(error);
  }
};

// POST /api/chat/message
exports.sendMessage = async (req, res, next) => {
  try {
    const { chatId, message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' });

    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ error: 'Chưa liên kết công ty' });

    // Find or create chat session
    let chat;
    if (chatId) {
      chat = await ChatHistory.findOne({ _id: chatId, company_id: companyId, user_id: req.user._id });
    }
    if (!chat) {
      chat = new ChatHistory({
        company_id: companyId,
        user_id: req.user._id,
        source: 'web',
        title: message.slice(0, 60),
        messages: [],
      });
    }

    // Add user message
    chat.messages.push({ role: 'user', content: message, timestamp: new Date() });

    // Process with smart query engine (pass chat history for multi-turn RAG)
    const aiResponse = await processQuery(message, companyId, chat.messages);

    // Enrich payload with generated images when chart data exists and no image was provided.
    const responsePayload = aiResponse.responsePayload || {
      markdown: aiResponse.text,
      charts: Array.isArray(aiResponse.chartData) ? aiResponse.chartData : aiResponse.chartData ? [aiResponse.chartData] : [],
      mermaid: [],
      images: [],
      confidence: 0.75,
    };

    if (!responsePayload.images?.length && shouldAutogenerateImages({
      message,
      intent: aiResponse.intent,
      charts: responsePayload.charts,
      channel: 'web',
    })) {
      const generated = await generateChartImages({
        companyId: String(companyId),
        charts: responsePayload.charts,
      });
      if (generated.length) {
        responsePayload.images = generated;
      }
    }

    // Convert absolute image URLs to relative paths for the web frontend
    // (Vite proxy handles /artifacts -> backend)
    if (responsePayload.images?.length) {
      responsePayload.images = responsePayload.images.map((img) => ({
        ...img,
        url: img.url.replace(/^https?:\/\/[^/]+/, ''),
      }));
    }

    // Add AI response
    chat.messages.push({
      role: 'assistant',
      content: responsePayload.markdown || aiResponse.text,
      chartData: aiResponse.chartData || null,
      responsePayload: responsePayload || null,
      timestamp: new Date(),
    });

    await chat.save();

    res.json({
      data: {
        chatId: chat._id,
        response: aiResponse.text,
        chartData: aiResponse.chartData || null,
        responsePayload: responsePayload || null,
        intent: aiResponse.intent,
      },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/chat/:chatId
exports.deleteChat = async (req, res, next) => {
  try {
    await ChatHistory.deleteOne({
      _id: req.params.chatId,
      company_id: req.user.company_id,
      user_id: req.user._id,
    });
    res.json({ message: 'Đã xóa' });
  } catch (error) {
    next(error);
  }
};
