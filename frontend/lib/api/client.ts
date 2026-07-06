// frontend/lib/api/client.ts
// ─────────────────────────────────────────────────────────────────────────────
// Axios instance configured for the LEO backend.
//   • Base URL → NEXT_PUBLIC_API_URL (default http://localhost:5000/api/v1)
//   • Request interceptor  → injects `Authorization: Bearer <accessToken>`
//   • Response interceptor → on 401, attempts a single refresh + retry;
//                            on failure, clears tokens and emits a
//                            'auth:logout' window event so the AuthContext
//                            can sync state.
// ─────────────────────────────────────────────────────────────────────────────

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from './token-storage';
import type { ApiErrorBody, ApiResponse, RefreshResponse } from './types';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export const AUTH_LOGOUT_EVENT = 'leo:auth:logout';

const client: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 300_000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // send the backend's httpOnly refreshToken cookie
});

// ── Request interceptor ───────────────────────────────────────────────────
client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const access = tokenStorage.getAccessToken();
  if (access && config.headers) {
    config.headers.set('Authorization', `Bearer ${access}`);
  }
  return config;
});

// ── Refresh logic ─────────────────────────────────────────────────────────
// Single-flight: a `refreshPromise` is shared between concurrent 401s so we
// don't burn the refresh token multiple times in parallel.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStorage.getRefreshToken();
  if (!refresh) return null;

  try {
    // Use a fresh, raw axios instance so the failing client doesn't loop.
    const res = await axios.post<ApiResponse<RefreshResponse>>(
      `${API_URL}/auth/refresh`,
      { refreshToken: refresh },
      { withCredentials: true },
    );
    const tokens = res.data?.data?.tokens;
    if (!tokens) return null;
    tokenStorage.setAccessToken(tokens.access.token);
    tokenStorage.setRefreshToken(
      tokens.refresh.token,
      Math.max(
        1,
        Math.floor((new Date(tokens.refresh.expires).getTime() - Date.now()) / 86_400_000),
      ),
    );
    return tokens.access.token;
  } catch {
    return null;
  }
}

// ── Response interceptor ──────────────────────────────────────────────────
client.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Only attempt refresh for 401, only once per request, and never on the
    // auth endpoints themselves (would cause an infinite loop).
    const isAuthEndpoint =
      original?.url?.includes('/auth/login') ||
      original?.url?.includes('/auth/register') ||
      original?.url?.includes('/auth/refresh');

    if (error.response?.status !== 401 || original?._retry || isAuthEndpoint || !original) {
      return Promise.reject(error);
    }

    original._retry = true;

    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }

    const newToken = await refreshPromise;
    if (newToken) {
      original.headers.set('Authorization', `Bearer ${newToken}`);
      return client(original);
    }

    // Refresh failed → force logout everywhere.
    tokenStorage.clearAll();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(AUTH_LOGOUT_EVENT));
    }
    return Promise.reject(error);
  },
);

export default client;
