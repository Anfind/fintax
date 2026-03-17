import api from './api';

export interface LoginPayload { email: string; password: string; }
export interface RegisterPayload { email: string; password: string; fullName: string; companyName?: string; taxCode?: string; }

export interface AuthResponse {
  token: string;
  user: {
    _id: string;
    email: string;
    fullName: string;
    role: string;
    avatar: string | null;
    company_id: string | null;
  };
  company: {
    _id: string;
    companyName: string;
    taxCode: string;
  } | null;
}

export const authService = {
  login: (data: LoginPayload) => api.post<AuthResponse>('/auth/login', data),
  register: (data: RegisterPayload) => api.post<AuthResponse>('/auth/register', data),
  getMe: () => api.get<{ user: AuthResponse['user']; company: AuthResponse['company'] }>('/auth/me'),
};
