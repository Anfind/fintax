import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, LogIn, Play, CheckCircle2, AlertCircle, Loader2,
  RefreshCw, History, Clock, Hash, FileText, ChevronRight, DatabaseZap
} from 'lucide-react';
import Header from '@/components/layout/Header';
import api from '@/services/api';
import { useSocket } from '@/hooks/useSocket';

type Step = 'captcha' | 'login' | 'crawl' | 'done';

interface CrawlHistoryItem {
  _id: string;
  status: string;
  startDate: string;
  endDate: string;
  invoiceType: string;
  result: { totalInvoices?: number; newInvoices?: number };
  progress: number;
  createdAt: string;
}

export default function CrawlPage() {
  const [step, setStep] = useState<Step>('captcha');
  const [captchaImg, setCaptchaImg] = useState('');
  const [captchaText, setCaptchaText] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [crawlProgress, setCrawlProgress] = useState(0);
  const [history, setHistory] = useState<CrawlHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Crawl params
  const [startDate, setStartDate] = useState('01/01/2024');
  const [endDate, setEndDate] = useState('31/12/2024');
  const [invoiceType, setInvoiceType] = useState<'sold' | 'purchased'>('sold');
  const [syncStatus, setSyncStatus] = useState('');

  const socket = useSocket();

  useEffect(() => {
    fetchCaptcha();
    fetchHistory();
  }, []);

  // Socket.io real-time events
  useEffect(() => {
    if (!socket) return;

    const handleCrawlCompleted = (data: { jobId: string; syncResult: { totalSynced: number; totalItems: number } }) => {
      setSyncStatus(`Đồng bộ xong: ${data.syncResult.totalSynced} hóa đơn, ${data.syncResult.totalItems} dòng chi tiết`);
      setCrawlProgress(100);
      fetchHistory();
    };

    const handleSyncProgress = (data: { progress: number; message: string }) => {
      setSyncStatus(data.message);
      setCrawlProgress(Math.min(90, data.progress));
    };

    socket.on('crawl:completed', handleCrawlCompleted);
    socket.on('sync:progress', handleSyncProgress);

    return () => {
      socket.off('crawl:completed', handleCrawlCompleted);
      socket.off('sync:progress', handleSyncProgress);
    };
  }, [socket]);

  const fetchCaptcha = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/crawl/captcha');
      setCaptchaImg(res.data.data.captchaImage);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Không thể tải captcha');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/crawl/history');
      setHistory(res.data.data || []);
    } catch {
      // silently fail
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!captchaText || !username || !password) {
      setError('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/crawl/login', { username, password, captcha: captchaText });
      setSuccess('Đăng nhập cổng thuế thành công!');
      setStep('crawl');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Đăng nhập thất bại');
      fetchCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleStartCrawl = async () => {
    setLoading(true);
    setError('');
    setCrawlProgress(0);
    try {
      const res = await api.post('/crawl/start', {
        startDate,
        endDate,
        invoiceType,
      });
      const jobData = res.data.data;
      setSuccess(`Hoàn thành! Job ID: ${jobData.jobId} — ${jobData.result?.message || ''}`);
      setStep('done');
      setCrawlProgress(100);
      fetchHistory();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Không thể bắt đầu quét');
    } finally {
      setLoading(false);
    }
  };

  const steps: { key: Step; label: string; icon: React.ReactNode }[] = [
    { key: 'captcha', label: 'Captcha', icon: <ShieldCheck size={20} /> },
    { key: 'login', label: 'Đăng nhập', icon: <LogIn size={20} /> },
    { key: 'crawl', label: 'Quét dữ liệu', icon: <Play size={20} /> },
    { key: 'done', label: 'Hoàn tất', icon: <CheckCircle2 size={20} /> },
  ];

  const stepOrder: Step[] = ['captcha', 'login', 'crawl', 'done'];
  const currentIdx = stepOrder.indexOf(step);

  return (
    <>
      <Header title="Thu thập dữ liệu" subtitle="Quét hóa đơn từ cổng thuế điện tử GDT" />

      <div className="p-6 md:p-8 space-y-8">
        {/* Stepper */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-6 border border-white/[0.06]"
        >
          <div className="flex items-center justify-between mb-8">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${
                      i < currentIdx
                        ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/40'
                        : i === currentIdx
                        ? 'bg-blue-500/20 text-blue-400 border-2 border-blue-500/50 shadow-lg shadow-blue-500/20'
                        : 'bg-white/5 text-slate-600 border-2 border-white/10'
                    }`}
                  >
                    {i < currentIdx ? <CheckCircle2 size={20} /> : s.icon}
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      i <= currentIdx ? 'text-white' : 'text-slate-600'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className="flex-1 mx-3">
                    <div className="h-0.5 rounded-full bg-white/10 relative overflow-hidden">
                      <motion.div
                        initial={{ width: '0%' }}
                        animate={{ width: i < currentIdx ? '100%' : '0%' }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Error / Success Banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400 text-sm"
              >
                <AlertCircle size={16} /> {error}
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-emerald-400 text-sm"
              >
                <CheckCircle2 size={16} /> {success}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            {step === 'captcha' && (
              <motion.div
                key="captcha"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h3 className="text-lg font-semibold text-white">Bước 1: Xác thực Captcha</h3>
                <p className="text-sm text-slate-400">Nhập mã captcha từ cổng thuế điện tử để tiếp tục.</p>

                <div className="flex items-end gap-4">
                  <div className="p-2 rounded-lg bg-white/10 border border-white/10">
                    {captchaImg ? (
                      <img src={captchaImg} alt="Captcha" className="h-12 rounded" />
                    ) : (
                      <div className="w-32 h-12 bg-white/5 rounded flex items-center justify-center">
                        <Loader2 size={20} className="text-slate-500 animate-spin" />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={fetchCaptcha}
                    className="p-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                  >
                    <RefreshCw size={18} className="text-slate-400" />
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Nhập captcha..."
                  value={captchaText}
                  onChange={(e) => setCaptchaText(e.target.value)}
                  className="w-full max-w-xs px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50"
                />

                <button
                  onClick={() => {
                    if (!captchaText) {
                      setError('Vui lòng nhập captcha');
                      return;
                    }
                    setStep('login');
                    setError('');
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all shadow-lg shadow-blue-600/30"
                >
                  Tiếp tục <ChevronRight size={16} />
                </button>
              </motion.div>
            )}

            {step === 'login' && (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h3 className="text-lg font-semibold text-white">Bước 2: Đăng nhập cổng thuế</h3>
                <p className="text-sm text-slate-400">Sử dụng tài khoản thuế điện tử của bạn.</p>

                <div className="space-y-3 max-w-sm">
                  <input
                    type="text"
                    placeholder="Mã số thuế / Tên đăng nhập"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50"
                  />
                  <input
                    type="password"
                    placeholder="Mật khẩu"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setStep('captcha'); setError(''); }}
                    className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-sm hover:bg-white/10 transition-all"
                  >
                    Quay lại
                  </button>
                  <button
                    onClick={handleLogin}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50"
                  >
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    Đăng nhập <ChevronRight size={16} />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'crawl' && (
              <motion.div
                key="crawl"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h3 className="text-lg font-semibold text-white">Bước 3: Cấu hình quét dữ liệu</h3>
                <p className="text-sm text-slate-400">Chọn khoảng thời gian và loại hóa đơn cần quét.</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Từ ngày</label>
                    <input
                      type="text"
                      placeholder="DD/MM/YYYY"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Đến ngày</label>
                    <input
                      type="text"
                      placeholder="DD/MM/YYYY"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Loại hóa đơn</label>
                    <select
                      value={invoiceType}
                      onChange={(e) => setInvoiceType(e.target.value as 'sold' | 'purchased')}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50"
                    >
                      <option value="sold">Hóa đơn bán ra</option>
                      <option value="purchased">Hóa đơn mua vào</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setStep('login'); setError(''); setSuccess(''); }}
                    className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-sm hover:bg-white/10 transition-all"
                  >
                    Quay lại
                  </button>
                  <button
                    onClick={handleStartCrawl}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-all shadow-lg shadow-emerald-600/30 disabled:opacity-50"
                  >
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    <Play size={16} />
                    Bắt đầu quét
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'done' && (
              <motion.div
                key="done"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center py-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                    className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-4"
                  >
                    <CheckCircle2 size={40} className="text-emerald-400" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-white">Đang quét dữ liệu!</h3>
                  <p className="text-slate-400 text-sm mt-2">Hệ thống đang xử lý hóa đơn của bạn...</p>

                  {syncStatus && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-3 flex items-center justify-center gap-2 text-sm text-blue-400"
                    >
                      <DatabaseZap size={14} />
                      {syncStatus}
                    </motion.div>
                  )}

                  {/* Progress Bar */}
                  <div className="max-w-sm mx-auto mt-6">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-slate-400">Tiến độ</span>
                      <span className="text-blue-400 font-mono-numbers">{crawlProgress}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        initial={{ width: '0%' }}
                        animate={{ width: `${crawlProgress}%` }}
                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setStep('captcha');
                    setCaptchaText('');
                    setUsername('');
                    setPassword('');
                    setError('');
                    setSuccess('');
                    fetchCaptcha();
                  }}
                  className="flex items-center gap-2 mx-auto px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-sm hover:bg-white/10 transition-all"
                >
                  <RefreshCw size={16} />
                  Quét lại
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Crawl History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-2xl border border-white/[0.06] overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-2">
            <History size={18} className="text-slate-400" />
            <h3 className="text-sm font-medium text-white">Lịch sử quét</h3>
          </div>

          {historyLoading ? (
            <div className="p-8 text-center">
              <Loader2 size={24} className="animate-spin text-slate-500 mx-auto" />
            </div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              Chưa có lịch sử quét nào
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {history.map((item) => (
                <div key={item._id} className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        item.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : item.status === 'running'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {item.status === 'running' ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <FileText size={18} />
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">
                        {item.invoiceType === 'sold' ? 'Hóa đơn bán ra' : 'Hóa đơn mua vào'}
                      </p>
                      <p className="text-xs text-slate-500">{item.startDate} → {item.endDate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-white font-mono-numbers">
                        <Hash size={12} className="inline mr-1 text-slate-600" />
                        {item.result?.totalInvoices ?? '—'} hóa đơn
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 justify-end">
                        <Clock size={12} />
                        {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                        item.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : item.status === 'running'
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                          : 'bg-red-500/20 text-red-400 border-red-500/30'
                      }`}
                    >
                      {item.status === 'completed' ? 'Hoàn tất' : item.status === 'running' ? 'Đang chạy' : 'Lỗi'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
}
