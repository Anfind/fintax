import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  _id: string;
  email: string;
  fullName: string;
  role: string;
  avatar: string | null;
  company_id: string | null;
}

interface Company {
  _id: string;
  companyName: string;
  taxCode: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  company: Company | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User, company: Company | null) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      company: null,
      isAuthenticated: false,

      setAuth: (token, user, company) =>
        set({ token, user, company, isAuthenticated: true }),

      logout: () =>
        set({ token: null, user: null, company: null, isAuthenticated: false }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    { name: 'fintax-auth' }
  )
);
