// backend/src/controllers/wallet.controller.ts
// ----------------------------------------------------------------------------
// HTTP controller for the /users/me/wallet endpoints.
//
// All three handlers are wrapped in `catchAsync` so any thrown `ApiError`
// (or unhandled rejection) is forwarded to the central error handler. The
// response envelope is the standard `ApiResponse<T>` shape the rest of the
// backend uses.
// ----------------------------------------------------------------------------

import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import ApiResponse from '../utils/ApiResponse';
import * as walletService from '../services/wallet.service';

export const linkWallet = catchAsync(async (req: Request, res: Response) => {
  const wallet = await walletService.linkWallet((req as any).user!.id, req.body);
  const response = new ApiResponse(httpStatus.OK, 'Wallet linked', wallet);
  res.status(response.statusCode).json(response);
});

export const listMyWallets = catchAsync(async (req: Request, res: Response) => {
  const wallets = await walletService.listWallets((req as any).user!.id);
  const response = new ApiResponse(
    httpStatus.OK,
    'Wallets retrieved successfully',
    wallets,
  );
  res.status(response.statusCode).json(response);
});

export const unlinkWallet = catchAsync(async (req: Request, res: Response) => {
  await walletService.unlinkWallet((req as any).user!.id, req.params.id);
  // 204 No Content — keeps the response body empty per HTTP convention.
  res.status(httpStatus.NO_CONTENT).send();
});
