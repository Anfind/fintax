import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, Loader2, ArrowRight } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/auth.store';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authService.login({ email, password });
      setAuth(data.token, data.user, data.company);
      navigate('/dashboard');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    paddingLeft: 44,
    paddingRight: 16,
    paddingTop: 12,
    paddingBottom: 12,
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

  const socialBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px 0',
    borderRadius: 12,
    fontSize: 13,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    color: '#94a3b8',
    cursor: 'pointer',
    transition: 'all 0.2s',
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
        padding: 16,
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
      <div className="floating-orb" style={{ position: 'absolute', top: '55%', left: '65%', width: 250, height: 250, background: 'rgba(59,130,246,0.08)', borderRadius: '50%', filter: 'blur(70px)' }} />
      <div
        style={{
          position: 'absolute', inset: 0, opacity: 0.03,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* ── Login Card ─────────────────────────────────── */}
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
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', color: '#f1f5f9', lineHeight: 1.2 }}>
                  FinTax<span style={{ color: '#818cf8' }}>.</span>
                </h1>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#64748b' }}>Financial Platform</p>
              </div>
            </div>
          </div>

          {/* ── Title ─────────────────────────────────── */}
          <h2 style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', marginBottom: 2, color: '#f1f5f9' }}>Chào mừng trở lại</h2>
          <p style={{ fontSize: 13, textAlign: 'center', marginBottom: 28, color: '#64748b' }}>Đăng nhập để quản lý tài chính của bạn</p>

          {/* ── Error ─────────────────────────────────── */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                marginBottom: 20, padding: '12px 16px', borderRadius: 12,
                fontSize: 13, textAlign: 'center',
                background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.15)', color: '#fb7185',
              }}
            >
              {error}
            </motion.div>
          )}

          {/* ── Form ──────────────────────────────────── */}
          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: '#cbd5e1' }}>Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={17} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@company.com"
                  required
                  style={inputStyle}
                  onFocus={focusInput}
                  onBlur={blurInput}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: '#cbd5e1' }}>Mật khẩu</label>
                <a href="#" style={{ fontSize: 12, color: '#818cf8', textDecoration: 'none' }}>Quên mật khẩu?</a>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={17} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ ...inputStyle, paddingRight: 44 }}
                  onFocus={focusInput}
                  onBlur={blurInput}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Submit */}
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
              {loading ? (
                <><Loader2 size={17} className="animate-spin" /> Đang đăng nhập...</>
              ) : (
                <>Đăng nhập <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          {/* ── Divider ───────────────────────────────── */}
          <div style={{ margin: '20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569' }}>hoặc</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
          </div>

          {/* ── Social Login ──────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button
              type="button"
              style={socialBtnStyle}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>
            <button
              type="button"
              style={socialBtnStyle}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path d="M11.4 24H0V12.6h11.4V24z" fill="#00A4EF"/>
                <path d="M24 24H12.6V12.6H24V24z" fill="#FFB900"/>
                <path d="M11.4 11.4H0V0h11.4v11.4z" fill="#F25022"/>
                <path d="M24 11.4H12.6V0H24v11.4z" fill="#7FBA00"/>
              </svg>
              Microsoft
            </button>
          </div>

          {/* ── Register Link ─────────────────────────── */}
          <p style={{ textAlign: 'center', fontSize: 13, marginTop: 24, color: '#64748b' }}>
            Chưa có tài khoản?{' '}
            <Link to="/register" style={{ fontWeight: 500, color: '#818cf8', textDecoration: 'none' }}>
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
