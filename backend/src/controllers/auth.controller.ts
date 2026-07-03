import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import * as authService from '../services/auth.service';
import * as tokenService from '../services/token.service';
import ApiResponse from '../utils/ApiResponse';
import config from '../config/config';

/** Helper: set refresh token cookie with correct production-grade options. */
const setRefreshCookie = (res: Response, token: string, expires: Date): void => {
  res.cookie('refreshToken', token, {
    httpOnly: true,                                    // Not accessible by JavaScript
    secure: config.isProduction,                       // HTTPS-only in production
    sameSite: config.isProduction ? 'strict' : 'lax', // CSRF protection
    expires,
  });
};

/** Helper: clear refresh token cookie. */
const clearRefreshCookie = (res: Response): void => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'strict' : 'lax',
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/register
// ─────────────────────────────────────────────────────────────────────────────
export const register = catchAsync(async (req: Request, res: Response) => {
  const user = await authService.registerUser(req.body);
  const tokens = await tokenService.generateAuthTokens(user.id, user.role);

  setRefreshCookie(res, tokens.refresh.token, tokens.refresh.expires);

  res.status(httpStatus.CREATED).json(
    new ApiResponse(httpStatus.CREATED, 'Registration successful', { user, tokens }),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/login
// ─────────────────────────────────────────────────────────────────────────────
export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await authService.loginWithEmailAndPassword(email, password);
  const tokens = await tokenService.generateAuthTokens(user.id, user.role);

  setRefreshCookie(res, tokens.refresh.token, tokens.refresh.expires);

  // Never return the password hash in responses
  const { password: _, ...safeUser } = user;

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'Login successful', { user: safeUser, tokens }),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/refresh
// ─────────────────────────────────────────────────────────────────────────────
export const refreshTokens = catchAsync(async (req: Request, res: Response) => {
  // Accept token from cookie (preferred) or request body (API clients)
  const refreshToken: string | undefined = req.cookies?.refreshToken ?? req.body?.refreshToken;

  if (!refreshToken) {
    return res
      .status(httpStatus.UNAUTHORIZED)
      .json(new ApiResponse(httpStatus.UNAUTHORIZED, 'Refresh token not provided'));
  }

  // Rotate the token — old one is invalidated, new pair is issued
  const user = await authService.refreshUserToken(refreshToken);
  const tokens = await tokenService.generateAuthTokens(user.id, user.role);

  setRefreshCookie(res, tokens.refresh.token, tokens.refresh.expires);

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'Tokens refreshed successfully', { tokens }),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/logout
// ─────────────────────────────────────────────────────────────────────────────
export const logout = catchAsync(async (req: Request, res: Response) => {
  const refreshToken: string | undefined = req.cookies?.refreshToken ?? req.body?.refreshToken;

  if (refreshToken) {
    await authService.logoutUser(refreshToken);
  }

  clearRefreshCookie(res);

  res.status(httpStatus.NO_CONTENT).send();
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/auth/me
// ─────────────────────────────────────────────────────────────────────────────
export const getMe = catchAsync(async (req: Request, res: Response) => {
  // req.user is populated by auth middleware (password already excluded)
  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'Current user', req.user),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/change-password
// ─────────────────────────────────────────────────────────────────────────────
export const changePassword = catchAsync(async (req: Request, res: Response) => {
  const { oldPassword, newPassword } = req.body;
  await authService.changeUserPassword(req.user!.id, oldPassword, newPassword);

  // Clear the refresh cookie — user must log in again on all devices
  clearRefreshCookie(res);

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'Password changed successfully. Please log in again.'),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/forgot-password
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Architecture Note:
 * This endpoint always returns 200 OK regardless of whether the email exists.
 * This prevents email enumeration attacks.
 *
 * In a full production system:
 *   1. generateResetPasswordToken returns a token if user exists
 *   2. An email service (SendGrid, Resend, SES) emails the link
 *   3. The link contains the token in a URL param
 *
 * For this implementation, the token is returned in the response body
 * for testing purposes. In production, remove this and send via email only.
 */
export const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  const resetToken = await tokenService.generateResetPasswordToken(email);

  // Always return the same response to prevent email enumeration
  const responseData = config.isProduction
    ? undefined
    : resetToken ? { resetToken } : undefined; // Only expose token in development

  res.status(httpStatus.OK).json(
    new ApiResponse(
      httpStatus.OK,
      'If an account with that email exists, a password reset link has been sent.',
      responseData,
    ),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/reset-password
// ─────────────────────────────────────────────────────────────────────────────
export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  await authService.resetUserPassword(token, newPassword);

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'Password has been reset successfully. Please log in.'),
  );
});
