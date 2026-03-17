import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Building2, Hash, Loader2, ArrowRight } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/auth.store';

export default function RegisterPage() {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', companyName: '', taxCode: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authService.register(form);
      setAuth(data.token, data.user, data.company);
      navigate('/dashboard');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  const update = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  const fields = [
    { key: 'fullName', label: 'Họ và tên', icon: User, type: 'text', placeholder: 'Nguyễn Văn A', required: true },
    { key: 'email', label: 'Email', icon: Mail, type: 'email', placeholder: 'email@company.com', required: true },
    { key: 'password', label: 'Mật khẩu', icon: Lock, type: 'password', placeholder: '••••••••', required: true },
    { key: 'companyName', label: 'Tên công ty', icon: Building2, type: 'text', placeholder: 'CÔNG TY ABC', required: false },
    { key: 'taxCode', label: 'Mã số thuế', icon: Hash, type: 'text', placeholder: '0302147168', required: false },
  ];

  const inputStyle: React.CSSProperties = {
    width: '100%',
    paddingLeft: 44,
    paddingRight: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 12,
    fontSize: 14,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#f1f5f9',
    outline: 'none',
    transition: 'all 0.2s',
  };
  const focusInput = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.border = '1px solid rgba(99,102,241,0.5)';
    e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)';
    e.target.style.background = 'rgba(255,255,255,0.06)';
  };
  const blurInput = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.border = '1px solid rgba(255,255,255,0.08)';
    e.target.style.boxShadow = 'none';
    e.target.style.background = 'rgba(255,255,255,0.04)';
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        padding: '32px 16px',
        background: 'linear-gradient(135deg, #020617 0%, #0c1222 35%, #0f172a 60%, #121a30 100%)',
      }}
    >
      {/* ── Animated Background ────────────────────────── */}
      <div
        style={{
          position: 'absolute', inset: 0, opacity: 0.4,
          backgroundImage: `
            radial-gradient(ellipse 60% 50% at 10% 20%, rgba(99,102,241,0.25) 0%, transparent 60%),
            radial-gradient(ellipse 50% 60% at 85% 80%, rgba(139,92,246,0.20) 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 50% 50%, rgba(59,130,246,0.10) 0%, transparent 60%)
          `,
        }}
      />
      <div className="floating-orb" style={{ position: 'absolute', top: '-15%', left: '-8%', width: 550, height: 550, background: 'rgba(99,102,241,0.15)', borderRadius: '50%', filter: 'blur(100px)' }} />
      <div className="floating-orb-reverse" style={{ position: 'absolute', bottom: '-18%', right: '-8%', width: 480, height: 480, background: 'rgba(139,92,246,0.12)', borderRadius: '50%', filter: 'blur(90px)' }} />
      <div
        style={{
          position: 'absolute', inset: 0, opacity: 0.03,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 400 }}
      >
        {/* Glow behind card */}
        <div
          style={{
            position: 'absolute', inset: -1, borderRadius: 26, opacity: 0.5,
            background: 'linear-gradient(145deg, rgba(99,102,241,0.25), rgba(139,92,246,0.10), transparent 60%)',
            filter: 'blur(1px)',
          }}
        />

        <div
          style={{
            position: 'relative',
            borderRadius: 24,
            padding: 32,
            background: 'linear-gradient(145deg, rgba(15,23,42,0.85) 0%, rgba(15,23,42,0.75) 100%)',
            backdropFilter: 'blur(40px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(40px) saturate(1.4)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 25px 60px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {/* ── Logo ──────────────────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: 12, opacity: 0.6, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', filter: 'blur(10px)' }} />
              <div
                style={{
                  position: 'relative', height: 44, width: 44, borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 24 }}>finance_chip</span>
              </div>
            </div>
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', marginBottom: 2, color: '#f1f5f9' }}>Tạo tài khoản</h2>
          <p style={{ fontSize: 13, textAlign: 'center', marginBottom: 24, color: '#64748b' }}>Bắt đầu phân tích tài chính ngay hôm nay</p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                marginBottom: 16, padding: '12px 16px', borderRadius: 12,
                fontSize: 13, textAlign: 'center',
                background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.15)', color: '#fb7185',
              }}
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit}>
            {fields.map(({ key, label, icon: Icon, type, placeholder, required }, idx) => (
              <div key={key} style={{ marginBottom: idx < fields.length - 1 ? 14 : 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: '#cbd5e1' }}>{label}</label>
                <div style={{ position: 'relative' }}>
                  <Icon size={17} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                  <input
                    type={type}
                    value={(form as Record<string, string>)[key]}
                    onChange={(e) => update(key, e.target.value)}
                    placeholder={placeholder}
                    required={required}
                    style={inputStyle}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  />
                </div>
              </div>
            ))}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 0',
                borderRadius: 12,
                fontWeight: 600,
                color: 'white',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)',
                boxShadow: loading ? 'none' : '0 8px 24px -4px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
                transition: 'all 0.3s',
              }}
              onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 12px 28px -4px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.15)'; } }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 24px -4px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.15)'; }}
            >
              {loading ? <><Loader2 size={17} className="animate-spin" /> Đang tạo...</> : <>Đăng ký <ArrowRight size={16} /></>}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 13, marginTop: 20, color: '#64748b' }}>
            Đã có tài khoản?{' '}
            <Link to="/login" style={{ fontWeight: 500, color: '#818cf8', textDecoration: 'none' }}>Đăng nhập</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
