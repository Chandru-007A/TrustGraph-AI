// frontend/lib/api/auth.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// Thin wrapper over the LEO backend auth endpoints.
// Returns the unwrapped `data` field, throws `Error` with a user-friendly
// `message` on failure (for sonner toasts).
// ─────────────────────────────────────────────────────────────────────────────

import client from './client';
import { extractError } from './errors';
import { tokenStorage } from './token-storage';
import type {
  ApiResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  User,
} from './types';

function persistTokens(payload: { tokens: { access: { token: string; expires: string | Date }; refresh: { token: string; expires: string | Date } }; user?: User }): void {
  const { access, refresh } = payload.tokens;
  tokenStorage.setAccessToken(access.token);
  tokenStorage.setRefreshToken(
    refresh.token,
    Math.max(
      1,
      Math.floor((new Date(refresh.expires).getTime() - Date.now()) / 86_400_000),
    ),
  );
  if (payload.user) {
    tokenStorage.setUser(payload.user);
  }
}

export const authService = {
  // ── POST /auth/login ──────────────────────────────────────────────────
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const res = await client.post<ApiResponse<LoginResponse>>(
        '/auth/login',
        credentials,
      );
      if (!res.data.data) throw new Error('Invalid server response');
      persistTokens(res.data.data);
      return res.data.data;
    } catch (err) {
      throw extractError(err, 'Login failed');
    }
  },

  // ── POST /auth/register ───────────────────────────────────────────────
  async register(payload: RegisterRequest): Promise<RegisterResponse> {
    try {
      const res = await client.post<ApiResponse<RegisterResponse>>(
        '/auth/register',
        payload,
      );
      if (!res.data.data) throw new Error('Invalid server response');
      persistTokens(res.data.data);
      return res.data.data;
    } catch (err) {
      throw extractError(err, 'Registration failed');
    }
  },

  // ── GET /auth/me ──────────────────────────────────────────────────────
  async getMe(): Promise<User> {
    try {
      const res = await client.get<ApiResponse<User>>('/auth/me');
      if (!res.data.data) throw new Error('Invalid server response');
      tokenStorage.setUser(res.data.data);
      return res.data.data;
    } catch (err) {
      throw extractError(err, 'Failed to load profile');
    }
  },

  // ── POST /auth/logout ─────────────────────────────────────────────────
  async logout(): Promise<void> {
    const refresh = tokenStorage.getRefreshToken();
    try {
      await client.post('/auth/logout', refresh ? { refreshToken: refresh } : {});
    } catch {
      // Server-side logout is best-effort — we still clear local state.
    } finally {
      tokenStorage.clearAll();
    }
  },

  // ── POST /auth/refresh (manual, exposed for hooks that want it) ───────
  async refresh(): Promise<void> {
    const refresh = tokenStorage.getRefreshToken();
    if (!refresh) throw new Error('No refresh token');
    const res = await client.post<ApiResponse<unknown>>('/auth/refresh', {
      refreshToken: refresh,
    });
    const tokens = (res.data.data as { tokens: { access: { token: string; expires: string | Date }; refresh: { token: string; expires: string | Date } } } | undefined)
      ?.tokens;
    if (!tokens) throw new Error('Invalid refresh response');
    tokenStorage.setAccessToken(tokens.access.token);
    tokenStorage.setRefreshToken(
      tokens.refresh.token,
      Math.max(
        1,
        Math.floor((new Date(tokens.refresh.expires).getTime() - Date.now()) / 86_400_000),
      ),
    );
  },
};
