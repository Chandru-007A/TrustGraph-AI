// frontend/lib/api/token-storage.ts
// ─────────────────────────────────────────────────────────────────────────────
// Token storage abstraction.
// ─────────────────────────────────────────────────────────────────────────────
// Design:
//   • ACCESS token  → kept in memory (React state) and mirrored to sessionStorage
//                     so a hard refresh keeps you signed in. NOT localStorage,
//                     so a long-lived XSS in another tab can't quietly lift it.
//   • REFRESH token → stored in a non-httpOnly cookie via the document.cookie
//                     API (js-cookie). The backend keeps the source of truth
//                     in Postgres (Token table); the cookie is just a transport
//                     convenience for the browser. Server-side, the httpOnly
//                     'refreshToken' cookie the backend SETS will always win
//                     for refresh calls.
//   • In production you can tighten this further by hosting the access token
//     entirely server-side (Next API route) and proxying requests — out of
//     scope for the current milestone.
// ─────────────────────────────────────────────────────────────────────────────

import Cookies from 'js-cookie';

const ACCESS_TOKEN_KEY = 'leo.access';
const REFRESH_TOKEN_COOKIE = 'leo.refresh';
const USER_KEY = 'leo.user';

const isBrowser = (): boolean => typeof window !== 'undefined';

export const tokenStorage = {
  // ── Access token (sessionStorage mirror) ──────────────────────────────
  getAccessToken(): string | null {
    if (!isBrowser()) return null;
    return window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
  },
  setAccessToken(token: string): void {
    if (!isBrowser()) return;
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  },
  clearAccessToken(): void {
    if (!isBrowser()) return;
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  },

  // ── Refresh token (cookie) ────────────────────────────────────────────
  getRefreshToken(): string | null {
    if (!isBrowser()) return null;
    return Cookies.get(REFRESH_TOKEN_COOKIE) ?? null;
  },
  setRefreshToken(token: string, expiresDays = 30): void {
    Cookies.set(REFRESH_TOKEN_COOKIE, token, {
      expires: expiresDays,
      sameSite: 'lax',
      secure: window.location.protocol === 'https:',
    });
  },
  clearRefreshToken(): void {
    Cookies.remove(REFRESH_TOKEN_COOKIE);
  },

  // ── Cached user (sessionStorage) ──────────────────────────────────────
  getUser<T>(): T | null {
    if (!isBrowser()) return null;
    const raw = window.sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  setUser<T>(user: T): void {
    if (!isBrowser()) return;
    window.sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clearUser(): void {
    if (!isBrowser()) return;
    window.sessionStorage.removeItem(USER_KEY);
  },

  // ── All-in-one helpers ────────────────────────────────────────────────
  clearAll(): void {
    this.clearAccessToken();
    this.clearRefreshToken();
    this.clearUser();
  },
};
