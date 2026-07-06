// frontend/contexts/auth-context.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Global auth state. Wraps the app at the root layout and exposes:
//   • user, status ('loading' | 'authenticated' | 'unauthenticated')
//   • login, register, logout, refresh
//   • getAccessToken() for components that need to pass it as a Bearer token
//
// Pattern: single React context + a custom hook. Persists `user` and the
// access token in sessionStorage so a hard refresh keeps the session alive.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { authService, tokenStorage } from '@/lib/api';
import { AUTH_LOGOUT_EVENT } from '@/lib/api/client';
import type { LoginRequest, RegisterRequest, User } from '@/lib/api/types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<User>;
  register: (payload: RegisterRequest) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  // ── Bootstrap on mount: validate stored access token via /auth/me ─────
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const access = tokenStorage.getAccessToken();
      const cachedUser = tokenStorage.getUser<User>();

      if (!access) {
        if (!cancelled) {
          setUser(null);
          setStatus('unauthenticated');
        }
        return;
      }

      // Optimistic: mark authenticated from cached user while we verify.
      if (cachedUser && !cancelled) {
        setUser(cachedUser);
        setStatus('authenticated');
      }

      try {
        const me = await authService.getMe();
        if (!cancelled) {
          setUser(me);
          setStatus('authenticated');
        }
      } catch {
        if (!cancelled) {
          tokenStorage.clearAll();
          setUser(null);
          setStatus('unauthenticated');
        }
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Listen for forced logout events from the axios interceptor ────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      setUser(null);
      setStatus('unauthenticated');
    };
    window.addEventListener(AUTH_LOGOUT_EVENT, handler);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, handler);
  }, []);

  // ── Public actions ────────────────────────────────────────────────────
  const login = useCallback(async (credentials: LoginRequest) => {
    const { user: u } = await authService.login(credentials);
    setUser(u);
    setStatus('authenticated');
    return u;
  }, []);

  const register = useCallback(async (payload: RegisterRequest) => {
    const { user: u } = await authService.register(payload);
    setUser(u);
    setStatus('authenticated');
    return u;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  const refresh = useCallback(async () => {
    await authService.refresh();
  }, []);

  const getAccessToken = useCallback(() => tokenStorage.getAccessToken(), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated',
      isLoading: status === 'loading',
      login,
      register,
      logout,
      refresh,
      getAccessToken,
    }),
    [user, status, login, register, logout, refresh, getAccessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}
