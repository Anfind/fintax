import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FileText,
  Bug,
  Bot,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

const mainNav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/crawl', label: 'Crawl Data', icon: Bug },
  { to: '/chat', label: 'AI Chat', icon: Bot },
];

const bottomNav = [
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ className }: { className?: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, company, logout } = useAuthStore();
  const location = useLocation();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={cn('hidden md:flex flex-col h-screen glass-sidebar flex-shrink-0 z-20 relative', className)}
    >
      {/* Logo */}
      <div className="p-6 flex items-center gap-3 mb-2">
        <div className="h-10 w-10 min-w-[40px] bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
          <span className="material-symbols-outlined text-[24px]">finance_chip</span>
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="flex flex-col overflow-hidden whitespace-nowrap"
            >
              <h1 className="text-xl font-bold text-white tracking-tight">
                FinTax<span className="text-blue-500">.</span>
              </h1>
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Financial Dashboard
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 h-6 w-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all z-50"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Main Nav */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {mainNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group',
                isActive
                  ? 'nav-active'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              )
            }
          >
            <item.icon
              size={20}
              className={cn(
                'min-w-[20px] transition-colors',
                location.pathname.startsWith(item.to) ? 'text-blue-400' : 'group-hover:text-blue-400'
              )}
            />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm font-medium whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
          </NavLink>
        ))}

        {/* Account Section */}
        <div className="pt-6 mt-4">
          {!collapsed && (
            <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
              Account
            </p>
          )}
          {bottomNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group',
                  isActive
                    ? 'nav-active'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                )
              }
            >
              <item.icon size={20} className="min-w-[20px] group-hover:text-blue-400 transition-colors" />
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* User Card */}
      <div className={cn('p-4 mx-3 mb-4 rounded-2xl bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border border-white/5', collapsed && 'mx-2 p-2')}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 min-w-[40px] rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm ring-2 ring-white/10">
              {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-emerald-500 border-2 border-[#0f172a] rounded-full" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.fullName || 'User'}</p>
              <p className="text-xs text-slate-400 truncate">{company?.companyName || user?.role || 'Member'}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={logout}
              className="text-slate-400 hover:text-white transition-colors"
              title="Đăng xuất"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
