import { User, Prisma } from '@prisma/client';
import prisma from '../utils/prisma';

/**
 * Create a new user
 * @param {Prisma.UserCreateInput} data
 * @returns {Promise<User>}
 */
export const createUser = async (data: Prisma.UserCreateInput): Promise<User> => {
  return prisma.user.create({
    data,
  });
};

/**
 * Query all users
 * @returns {Promise<User[]>}
 */
export const queryUsers = async (): Promise<User[]> => {
  return prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
  });
};

/**
 * Get user by ID
 * @param {string} id
 * @returns {Promise<User | null>}
 */
export const getUserById = async (id: string): Promise<User | null> => {
  return prisma.user.findUnique({
    where: { id },
  });
};

/**
 * Update user by ID
 * @param {string} id
 * @param {Prisma.UserUpdateInput} updateBody
 * @returns {Promise<User>}
 */
export const updateUserById = async (id: string, updateBody: Prisma.UserUpdateInput): Promise<User> => {
  return prisma.user.update({
    where: { id },
    data: updateBody,
  });
};

/**
 * Delete user by ID
 * @param {string} id
 * @returns {Promise<User>}
 */
export const deleteUserById = async (id: string): Promise<User> => {
  return prisma.user.delete({
    where: { id },
  });
};
