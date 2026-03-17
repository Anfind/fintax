import { Bell, Moon, Search, Menu } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useLayoutContext } from '@/hooks/useLayoutContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onMobileMenuToggle?: () => void;
}

export default function Header({ title, subtitle, onMobileMenuToggle }: HeaderProps) {
  const { user } = useAuthStore();
  const ctx = useLayoutContext();
  const toggleMenu = onMobileMenuToggle ?? ctx?.onMobileMenuToggle;

  return (
    <header className="h-20 flex items-center justify-between px-6 md:px-8 glass-header z-10 sticky top-0">
      {/* Left: Mobile menu + Title */}
      <div className="flex items-center gap-4">
        <button
          className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg"
          onClick={toggleMenu}
        >
          <Menu size={22} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
          {subtitle && (
            <p className="text-xs text-slate-400 hidden md:block">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Right: Search + Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="hidden sm:flex items-center bg-white/5 hover:bg-white/10 rounded-full px-4 py-2.5 w-64 border border-white/5 focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
          <Search size={16} className="text-slate-400" />
          <input
            type="text"
            placeholder="Search transactions..."
            className="bg-transparent border-none text-sm text-slate-200 placeholder-slate-500 focus:outline-none w-full ml-2"
          />
        </div>

        {/* Notifications */}
        <button className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all relative border border-white/5 group">
          <Bell size={20} className="group-hover:scale-110 transition-transform duration-200" />
          <span className="absolute top-2.5 right-3 h-2 w-2 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
        </button>

        {/* Theme Toggle */}
        <button className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/5">
          <Moon size={20} />
        </button>

        {/* Avatar */}
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm ring-2 ring-white/10 cursor-pointer hover:ring-blue-500/50 transition-all">
          {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
        </div>
      </div>
    </header>
  );
}
