import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Bot, User, Sparkles, TrendingUp, BarChart3,
  Loader2, Trash2, Plus, MessageSquare, Clock, PanelLeftOpen
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Line, Area, AreaChart,
  PieChart, Pie, Cell, Legend,
  ComposedChart,
} from 'recharts';
import Header from '@/components/layout/Header';
import { chatService } from '@/services/chat.service';
import type { AssistantResponsePayload, ChatMessage, ChartData, ChatSession } from '@/services/chat.service';
import { formatCompactVND } from '@/lib/utils';
import MarkdownRenderer from '@/components/chat/MarkdownRenderer';
import MermaidDiagram from '@/components/chat/MermaidDiagram';

/* ───── Types ───── */
interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  chartData?: ChartData | ChartData[] | null;
  responsePayload?: AssistantResponsePayload | null;
  timestamp: Date;
}

/* ───── Constants ───── */
const WELCOME_MSG: DisplayMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Xin chào! Tôi là **FinTax AI Assistant** 🤖\n\nTôi được trang bị AI (RAG + GPT) để phân tích dữ liệu hóa đơn, doanh thu, chi phí và đưa ra gợi ý tài chính thông minh.\n\nHãy hỏi tôi bất cứ điều gì về tài chính doanh nghiệp!',
  timestamp: new Date(),
};

const suggestedQueries = [
  { icon: <TrendingUp size={16} />, text: 'Phân tích xu hướng doanh thu 6 tháng gần nhất' },
  { icon: <BarChart3 size={16} />, text: 'Tổng quan tài chính năm 2025' },
  { icon: <Sparkles size={16} />, text: 'Top 5 khách hàng có doanh thu cao nhất' },
  { icon: <BarChart3 size={16} />, text: 'So sánh doanh thu và chi phí từ tháng 1 đến tháng 6' },
];

/* ───── Inline Chart (supports bar + line + area + pie + composed) ───── */
const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function InlineChart({ chartData }: { chartData: ChartData }) {
  if (!chartData.data?.length) return null;

  const tooltipStyle = {
    background: 'rgba(15,23,42,0.95)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    fontSize: 12,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fmtTooltip = (v: any) => [formatCompactVND(v ?? 0), chartData.label || ''];

  // PIE chart
  if (chartData.type === 'pie') {
    return (
      <div className="mt-3 bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
        {chartData.label && <p className="text-xs text-slate-400 mb-2 font-medium">{chartData.label}</p>}
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={chartData.data}
              dataKey={chartData.yKey}
              nameKey={chartData.xKey}
              cx="50%"
              cy="50%"
              outerRadius={90}
              innerRadius={45}
              paddingAngle={2}
              strokeWidth={0}
            >
              {chartData.data.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={fmtTooltip} />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value: string) => <span className="text-slate-300 text-xs">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // LINE / AREA chart
  if (chartData.type === 'line' || chartData.type === 'area') {
    return (
      <div className="mt-3 bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
        {chartData.label && <p className="text-xs text-slate-400 mb-2 font-medium">{chartData.label}</p>}
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData.data}>
            <defs>
              <linearGradient id="chatLineGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey={chartData.xKey} stroke="#64748b" fontSize={11} />
            <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v: number) => formatCompactVND(v)} />
            <Tooltip contentStyle={tooltipStyle} formatter={fmtTooltip} />
            <Area type="monotone" dataKey={chartData.yKey} stroke="#3b82f6" strokeWidth={2} fill="url(#chatLineGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // COMPOSED chart (multi-series: auto-detect numeric fields)
  if (chartData.type === 'composed') {
    const allKeys = Object.keys(chartData.data[0] || {}).filter(k => k !== chartData.xKey && typeof chartData.data[0][k] === 'number');
    const seriesColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    return (
      <div className="mt-3 bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
        {chartData.label && <p className="text-xs text-slate-400 mb-2 font-medium">{chartData.label}</p>}
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={chartData.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey={chartData.xKey} stroke="#64748b" fontSize={11} />
            <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v: number) => formatCompactVND(v)} />
            <Tooltip contentStyle={tooltipStyle} />
            {allKeys.map((key, i) => (
              i === 0
                ? <Bar key={key} dataKey={key} fill={seriesColors[i % seriesColors.length]} radius={[4, 4, 0, 0]} fillOpacity={0.7} />
                : <Line key={key} dataKey={key} stroke={seriesColors[i % seriesColors.length]} strokeWidth={2} dot={{ r: 3 }} />
            ))}
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Default: BAR chart
  return (
    <div className="mt-3 bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
      {chartData.label && <p className="text-xs text-slate-400 mb-2 font-medium">{chartData.label}</p>}
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey={chartData.xKey} stroke="#64748b" fontSize={11} />
          <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v: number) => formatCompactVND(v)} />
          <Tooltip contentStyle={tooltipStyle} formatter={fmtTooltip} />
          <Bar dataKey={chartData.yKey} fill="#3b82f6" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ───── Multi-Chart Renderer ───── */
function RenderCharts({ chartData }: { chartData: ChartData | ChartData[] | null | undefined }) {
  if (!chartData) return null;
  const charts = Array.isArray(chartData) ? chartData : [chartData];
  return (
    <>
      {charts.map((cd, i) => (
        <InlineChart key={i} chartData={cd} />
      ))}
    </>
  );
}

function RenderMermaid({ responsePayload }: { responsePayload?: AssistantResponsePayload | null }) {
  const blocks = responsePayload?.mermaid || [];
  if (!blocks.length) return null;
  return (
    <>
      {blocks.map((block, i) => (
        <MermaidDiagram key={`mermaid-${i}`} code={block.code} />
      ))}
    </>
  );
}

function RenderImages({ responsePayload }: { responsePayload?: AssistantResponsePayload | null }) {
  const images = responsePayload?.images || [];
  if (!images.length) return null;
  return (
    <div className="mt-3 space-y-3">
      {images.map((image, i) => (
        <figure key={`image-${i}`} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-2">
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <img
            src={image.url}
            alt={image.alt || `image-${i + 1}`}
            className="w-full rounded-lg object-cover"
            loading="lazy"
          />
          {(image.caption || image.alt) && (
            <figcaption className="mt-2 text-xs text-slate-400">
              {image.caption || image.alt}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════ */
export default function ChatPage() {
  const [messages, setMessages] = useState<DisplayMessage[]>([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* auto-scroll */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ── Chat history ── */
  const loadHistory = useCallback(async () => {
    try {
      const res = await chatService.getHistory();
      setChatHistory(res.data.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const loadChat = async (id: string) => {
    try {
      const res = await chatService.getChatById(id);
      const chat = res.data.data;
      setChatId(chat._id);
      setMessages(
        chat.messages.map((m: ChatMessage, i: number) => ({
          id: `${chat._id}-${i}`,
          role: m.role as 'user' | 'assistant',
          content: m.responsePayload?.markdown || m.content,
          chartData: m.responsePayload?.charts?.length ? m.responsePayload.charts : m.chartData,
          responsePayload: m.responsePayload,
          timestamp: new Date(m.timestamp),
        }))
      );
      setShowHistory(false);
    } catch { /* ignore */ }
  };

  const startNewChat = () => {
    setChatId(null);
    setMessages([{ ...WELCOME_MSG, id: `welcome-${Date.now()}`, timestamp: new Date() }]);
    setShowHistory(false);
  };

  const deleteChat = async (id: string) => {
    try {
      await chatService.deleteChat(id);
      setChatHistory((prev) => prev.filter((c) => c._id !== id));
      if (chatId === id) startNewChat();
    } catch { /* ignore */ }
  };

  /* ── Send message ── */
  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isTyping) return;

    const userMsg: DisplayMessage = { id: `u-${Date.now()}`, role: 'user', content: msg, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const res = await chatService.sendMessage({ chatId: chatId || undefined, message: msg });
      const data = res.data.data;
      if (!chatId) setChatId(data.chatId);

      const aiMsg: DisplayMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.responsePayload?.markdown || data.response,
        chartData: data.responsePayload?.charts?.length ? data.responsePayload.charts : data.chartData,
        responsePayload: data.responsePayload,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      loadHistory();
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'assistant', content: '❌ Không thể xử lý yêu cầu. Vui lòng thử lại.', timestamp: new Date() },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <>
      <Header title="AI Chat" subtitle="Trò chuyện với AI để phân tích dữ liệu tài chính" />

      <div className="flex h-[calc(100vh-80px)]">
        {/* ── History Sidebar ── */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-r border-white/[0.06] flex flex-col overflow-hidden shrink-0"
            >
              <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Lịch sử chat</h3>
                <button onClick={startNewChat} className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors">
                  <Plus size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {chatHistory.map((c) => (
                  <div
                    key={c._id}
                    onClick={() => loadChat(c._id)}
                    className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                      chatId === c._id ? 'bg-blue-600/20 border border-blue-500/20' : 'hover:bg-white/5'
                    }`}
                  >
                    <MessageSquare size={14} className="text-slate-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-300 truncate">{c.title}</p>
                      <p className="text-[10px] text-slate-600 flex items-center gap-1 mt-0.5">
                        <Clock size={10} />
                        {new Date(c.updatedAt).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteChat(c._id); }}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {chatHistory.length === 0 && (
                  <p className="text-xs text-slate-600 text-center py-8">Chưa có cuộc trò chuyện nào</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Main Chat ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* toolbar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06]">
            <button onClick={() => setShowHistory((v) => !v)} className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all" title="Lịch sử chat">
              <PanelLeftOpen size={16} />
            </button>
            <button onClick={startNewChat} className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all" title="Chat mới">
              <Plus size={16} />
            </button>
          </div>

          {/* messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
                    <Bot size={18} className="text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-blue-600/30 border border-blue-500/20 text-white'
                      : 'bg-white/[0.05] border border-white/[0.08] text-slate-200'
                  }`}
                >
                  <MarkdownRenderer content={msg.content} />
                  {msg.chartData && <RenderCharts chartData={msg.chartData} />}
                  <RenderMermaid responsePayload={msg.responsePayload} />
                  <RenderImages responsePayload={msg.responsePayload} />
                  {typeof msg.responsePayload?.confidence === 'number' && (
                    <div className="mt-2 inline-flex items-center rounded-full border border-slate-500/20 bg-slate-500/10 px-2 py-0.5 text-[10px] text-slate-400">
                      Độ tin cậy: {(msg.responsePayload.confidence * 100).toFixed(0)}%
                    </div>
                  )}
                  <p className="text-[10px] text-slate-600 mt-2">
                    {msg.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {msg.role === 'user' && (
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                    <User size={18} className="text-white" />
                  </div>
                )}
              </motion.div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 items-start">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                  <Bot size={18} className="text-white" />
                </div>
                <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-3 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </motion.div>
            )}

            {/* Suggested queries */}
            {messages.length <= 1 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-8">
                {suggestedQueries.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q.text)}
                    className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] text-left text-sm text-slate-300 hover:bg-white/[0.06] hover:border-blue-500/20 transition-all group"
                  >
                    <span className="text-blue-400 group-hover:text-blue-300 transition-colors">{q.icon}</span>
                    {q.text}
                  </button>
                ))}
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-white/[0.06] p-4">
            <div className="flex items-end gap-3 max-w-4xl mx-auto">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                  }}
                  placeholder="Hỏi về dữ liệu tài chính... (VD: Tổng doanh thu tháng 6)"
                  rows={1}
                  className="w-full px-4 py-3 pr-12 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all resize-none"
                />
              </div>
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isTyping}
                className="p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-600/30 disabled:opacity-40 disabled:shadow-none shrink-0"
              >
                {isTyping ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
            <p className="text-center text-[11px] text-slate-600 mt-2">
              FinTax AI phân tích dữ liệu trực tiếp từ database hóa đơn của bạn.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
