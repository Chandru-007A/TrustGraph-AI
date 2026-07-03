import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import * as userService from '../services/user.service';
import ApiError from '../utils/ApiError';
import ApiResponse from '../utils/ApiResponse';

export const createUser = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.createUser(req.body);
  const response = new ApiResponse(httpStatus.CREATED, 'User created successfully', user);
  res.status(response.statusCode).json(response);
});

export const getUsers = catchAsync(async (req: Request, res: Response) => {
  const users = await userService.queryUsers();
  const response = new ApiResponse(httpStatus.OK, 'Users retrieved successfully', users);
  res.status(response.statusCode).json(response);
});

export const getUser = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.getUserById(req.params.id);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  const response = new ApiResponse(httpStatus.OK, 'User retrieved successfully', user);
  res.status(response.statusCode).json(response);
});

export const updateUser = catchAsync(async (req: Request, res: Response) => {
  // Check if user exists before attempting update (Prisma throws P2025 otherwise)
  const userExists = await userService.getUserById(req.params.id);
  if (!userExists) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const user = await userService.updateUserById(req.params.id, req.body);
  const response = new ApiResponse(httpStatus.OK, 'User updated successfully', user);
  res.status(response.statusCode).json(response);
});

export const deleteUser = catchAsync(async (req: Request, res: Response) => {
  const userExists = await userService.getUserById(req.params.id);
  if (!userExists) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  await userService.deleteUserById(req.params.id);
  const response = new ApiResponse(httpStatus.OK, 'User deleted successfully');
  res.status(response.statusCode).json(response);
});
