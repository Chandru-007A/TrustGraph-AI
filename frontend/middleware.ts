// frontend/middleware.ts
// ─────────────────────────────────────────────────────────────────────────────
// Edge-level route protection.
//
// We can't read sessionStorage in middleware (Edge runtime), so the source
// of truth here is the *non-httpOnly* `leo.refresh` cookie. The presence of
// that cookie means the user has a refresh token; the actual access token
// validation happens client-side in AuthProvider via /auth/me. The middleware
// simply gates entry — if the cookie is missing we send them to /login.
//
// Public routes (no cookie required):
//   • /            — landing
//   • /login       — sign in
//   • /register    — sign up
//   • /forgot-password, /reset-password
//   • /api/*       — API routes (the backend has its own auth)
//   • /_next/*, static files
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = new Set<string>(['/', '/login', '/register', '/forgot-password', '/reset-password']);

const REFRESH_COOKIE = 'leo.refresh';

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith('/_next')) return true;
  if (pathname.startsWith('/api')) return true;
  if (pathname.startsWith('/favicon')) return true;
  if (pathname.includes('.')) return true; // any static asset
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const hasSession = req.cookies.get(REFRESH_COOKIE)?.value;
  if (hasSession) return NextResponse.next();

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.searchParams.set('next', pathname + search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run on everything except Next's internal assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
