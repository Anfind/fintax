import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User, Building2, Bell, Shield, Palette, Database, Save,
  Check, Eye, EyeOff, Send
} from 'lucide-react';
import Header from '@/components/layout/Header';
import { useAuthStore } from '@/store/auth.store';
import api from '@/services/api';

// Sub-components defined outside to avoid re-creation during render
function InputField({
  label, value, onChange, type = 'text', placeholder = '', disabled = false
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-slate-500 mb-1.5 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      />
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm text-slate-300">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-all duration-300 ${
          checked ? 'bg-blue-600' : 'bg-white/10'
        }`}
      >
        <div
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { user, company } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [saved, setSaved] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [profile, setProfile] = useState({
    name: user?.fullName || '',
    email: user?.email || '',
    phone: '',
    currentPassword: '',
    newPassword: '',
  });

  const [companyInfo, setCompanyInfo] = useState({
    name: company?.companyName || '',
    taxCode: company?.taxCode || '',
    address: '',
    representative: '',
  });

  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    crawlComplete: true,
    invoiceAnomalies: true,
    weeklyReport: false,
    telegramEnabled: false,
    telegramChatId: '',
  });

  const tabs = [
    { key: 'profile', label: 'Hồ sơ', icon: <User size={18} /> },
    { key: 'company', label: 'Công ty', icon: <Building2 size={18} /> },
    { key: 'notifications', label: 'Thông báo', icon: <Bell size={18} /> },
    { key: 'security', label: 'Bảo mật', icon: <Shield size={18} /> },
    { key: 'appearance', label: 'Giao diện', icon: <Palette size={18} /> },
    { key: 'data', label: 'Dữ liệu', icon: <Database size={18} /> },
  ];

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <Header title="Cài đặt" subtitle="Quản lý tài khoản và tùy chỉnh hệ thống" />

      <div className="p-6 md:p-8">
        <div className="flex flex-col lg:flex-row gap-6 max-w-5xl">
          {/* Sidebar Tabs */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:w-56 shrink-0"
          >
            <nav className="glass-card rounded-2xl border border-white/[0.06] overflow-hidden">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-all ${
                    activeTab === tab.key
                      ? 'bg-blue-500/10 text-blue-400 border-l-2 border-blue-500'
                      : 'text-slate-400 hover:bg-white/[0.03] hover:text-white border-l-2 border-transparent'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </motion.div>

          {/* Content */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 glass-card rounded-2xl border border-white/[0.06] p-6"
          >
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">Thông tin cá nhân</h3>
                  <p className="text-sm text-slate-500">Cập nhật thông tin tài khoản của bạn</p>
                </div>

                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xl font-bold text-white">
                    {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                      Thay đổi ảnh đại diện
                    </button>
                    <p className="text-xs text-slate-600 mt-0.5">JPG, PNG tối đa 2MB</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField label="Họ tên" value={profile.name} onChange={(v) => setProfile({ ...profile, name: v })} />
                  <InputField label="Email" value={profile.email} onChange={(v) => setProfile({ ...profile, email: v })} type="email" />
                  <InputField label="Số điện thoại" value={profile.phone} onChange={(v) => setProfile({ ...profile, phone: v })} placeholder="0xxx xxx xxx" />
                </div>
              </div>
            )}

            {activeTab === 'company' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">Thông tin công ty</h3>
                  <p className="text-sm text-slate-500">Thông tin doanh nghiệp liên kết với tài khoản</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField label="Tên công ty" value={companyInfo.name} onChange={(v) => setCompanyInfo({ ...companyInfo, name: v })} />
                  <InputField label="Mã số thuế" value={companyInfo.taxCode} onChange={(v) => setCompanyInfo({ ...companyInfo, taxCode: v })} />
                  <div className="md:col-span-2">
                    <InputField label="Địa chỉ" value={companyInfo.address} onChange={(v) => setCompanyInfo({ ...companyInfo, address: v })} placeholder="Địa chỉ đăng ký kinh doanh" />
                  </div>
                  <InputField label="Người đại diện" value={companyInfo.representative} onChange={(v) => setCompanyInfo({ ...companyInfo, representative: v })} />
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">Thông báo</h3>
                  <p className="text-sm text-slate-500">Quản lý cách nhận thông báo từ hệ thống</p>
                </div>
                <div className="divide-y divide-white/[0.06]">
                  <Toggle label="Gửi thông báo qua email" checked={notifications.emailAlerts} onChange={(v) => setNotifications({ ...notifications, emailAlerts: v })} />
                  <Toggle label="Hoàn tất quét dữ liệu" checked={notifications.crawlComplete} onChange={(v) => setNotifications({ ...notifications, crawlComplete: v })} />
                  <Toggle label="Phát hiện bất thường hóa đơn" checked={notifications.invoiceAnomalies} onChange={(v) => setNotifications({ ...notifications, invoiceAnomalies: v })} />
                  <Toggle label="Báo cáo hàng tuần" checked={notifications.weeklyReport} onChange={(v) => setNotifications({ ...notifications, weeklyReport: v })} />
                </div>

                <div className="pt-4 border-t border-white/[0.06]">
                  <h4 className="text-sm font-medium text-white mb-1">Telegram Bot</h4>
                  <p className="text-xs text-slate-500 mb-3">Liên kết với Telegram để nhận thông báo và truy vấn dữ liệu qua chat.</p>
                  <Toggle label="Kích hoạt thông báo Telegram" checked={notifications.telegramEnabled} onChange={(v) => setNotifications({ ...notifications, telegramEnabled: v })} />
                  {notifications.telegramEnabled && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3">
                      <InputField label="Group Chat ID" value={notifications.telegramChatId} onChange={(v) => setNotifications({ ...notifications, telegramChatId: v })} placeholder="Gửi /link MST trong group Telegram" />
                      <div className="flex items-center gap-3">
                        <button
                          onClick={async () => {
                            try {
                              await api.put('/telegram/settings', { telegramGroupId: notifications.telegramChatId });
                              setSaved(true); setTimeout(() => setSaved(false), 2000);
                            } catch { /* ignore */ }
                          }}
                          className="px-4 py-2 rounded-lg bg-blue-600/20 text-blue-400 text-sm border border-blue-500/30 hover:bg-blue-600/30 transition-all"
                        >
                          <Save size={14} className="inline mr-1.5" />
                          Lưu Chat ID
                        </button>
                        <button
                          onClick={async () => {
                            try { await api.post('/telegram/test'); } catch { /* ignore */ }
                          }}
                          className="px-4 py-2 rounded-lg bg-emerald-600/20 text-emerald-400 text-sm border border-emerald-500/30 hover:bg-emerald-600/30 transition-all"
                        >
                          <Send size={14} className="inline mr-1.5" />
                          Test kết nối
                        </button>
                      </div>
                      <div className="mt-2 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-xs text-slate-500">
                        <p className="font-medium text-slate-400 mb-1">Hướng dẫn:</p>
                        <ol className="list-decimal list-inside space-y-0.5">
                          <li>Thêm bot <code className="text-blue-400">@FinTaxBot</code> vào group Telegram</li>
                          <li>Gửi <code className="text-blue-400">/link {'{mã_số_thuế}'}</code> trong group</li>
                          <li>Bot sẽ tự động liên kết — hoặc nhập Group ID ở trên</li>
                        </ol>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">Bảo mật</h3>
                  <p className="text-sm text-slate-500">Đổi mật khẩu và cấu hình bảo mật</p>
                </div>
                <div className="space-y-4 max-w-md">
                  <div className="relative">
                    <InputField label="Mật khẩu hiện tại" value={profile.currentPassword} onChange={(v) => setProfile({ ...profile, currentPassword: v })} type={showPassword ? 'text' : 'password'} />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-8 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <InputField label="Mật khẩu mới" value={profile.newPassword} onChange={(v) => setProfile({ ...profile, newPassword: v })} type="password" />
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">Giao diện</h3>
                  <p className="text-sm text-slate-500">Tùy chỉnh giao diện hiển thị</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { name: 'Tối (Dark)', class: 'bg-slate-900 border-blue-500', active: true },
                    { name: 'Sáng (Light)', class: 'bg-slate-100', active: false },
                    { name: 'Tự động', class: 'bg-gradient-to-r from-slate-900 to-slate-100', active: false },
                  ].map((theme) => (
                    <button
                      key={theme.name}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        theme.active ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className={`w-full h-16 rounded-lg ${theme.class} mb-2`} />
                      <p className={`text-xs font-medium ${theme.active ? 'text-blue-400' : 'text-slate-400'}`}>
                        {theme.name}
                        {theme.active && <Check size={12} className="inline ml-1" />}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'data' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">Quản lý dữ liệu</h3>
                  <p className="text-sm text-slate-500">Quản lý dữ liệu và đồng bộ hệ thống</p>
                </div>
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white font-medium">Đồng bộ dữ liệu</p>
                      <p className="text-xs text-slate-500">Đồng bộ dữ liệu từ crawler sang hệ thống phân tích</p>
                    </div>
                    <button className="px-4 py-2 rounded-lg bg-blue-600/20 text-blue-400 text-sm border border-blue-500/30 hover:bg-blue-600/30 transition-all">
                      Đồng bộ
                    </button>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white font-medium">Xuất dữ liệu</p>
                      <p className="text-xs text-slate-500">Xuất toàn bộ dữ liệu dạng CSV hoặc JSON</p>
                    </div>
                    <button className="px-4 py-2 rounded-lg bg-emerald-600/20 text-emerald-400 text-sm border border-emerald-500/30 hover:bg-emerald-600/30 transition-all">
                      Xuất CSV
                    </button>
                  </div>
                  <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-red-400 font-medium">Xóa toàn bộ dữ liệu</p>
                      <p className="text-xs text-slate-500">Hành động này không thể hoàn tác</p>
                    </div>
                    <button className="px-4 py-2 rounded-lg bg-red-600/20 text-red-400 text-sm border border-red-500/30 hover:bg-red-600/30 transition-all">
                      Xóa
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="mt-8 flex items-center justify-end gap-3">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all shadow-lg shadow-blue-600/30"
              >
                {saved ? <Check size={16} /> : <Save size={16} />}
                {saved ? 'Đã lưu!' : 'Lưu thay đổi'}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}
