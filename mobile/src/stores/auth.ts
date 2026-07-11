import { create } from 'zustand';
import { api } from '@/src/lib/api';
import { tokenStore } from '@/src/lib/storage';
import { clearChatCache } from '@/src/lib/chatCache';

export type Role = 'warden' | 'staff' | 'student' | 'super_admin' | 'cook';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  hostelId: string;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  initialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,

  login: async (email, password) => {
    set({ loading: true });
    try {
      const res = await api.post('/auth/login', { email, password });
      await tokenStore.save(res.data.accessToken, res.data.refreshToken);
      set({ user: res.data.user });
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    const refreshToken = await tokenStore.getRefresh();
    try {
      if (refreshToken) await api.post('/auth/logout', { refreshToken });
    } catch {
      // ignore network errors on logout
    }
    await tokenStore.clear();
    await clearChatCache();
    set({ user: null });
  },

  bootstrap: async () => {
    try {
      const token = await tokenStore.getAccess();
      if (!token) {
        set({ initialized: true });
        return;
      }
      const res = await api.get('/auth/me');
      set({ user: res.data });
    } catch {
      await tokenStore.clear();
    } finally {
      set({ initialized: true });
    }
  },
}));
