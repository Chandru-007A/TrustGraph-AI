"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUserById = exports.updateUserById = exports.getUserById = exports.queryUsers = exports.createUser = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
/**
 * Create a new user
 * @param {Prisma.UserCreateInput} data
 * @returns {Promise<User>}
 */
const createUser = async (data) => {
    return prisma_1.default.user.create({
        data,
    });
};
exports.createUser = createUser;
/**
 * Query all users
 * @returns {Promise<User[]>}
 */
const queryUsers = async () => {
    return prisma_1.default.user.findMany({
        orderBy: { createdAt: 'desc' },
    });
};
exports.queryUsers = queryUsers;
/**
 * Get user by ID
 * @param {string} id
 * @returns {Promise<User | null>}
 */
const getUserById = async (id) => {
    return prisma_1.default.user.findUnique({
        where: { id },
    });
};
exports.getUserById = getUserById;
/**
 * Update user by ID
 * @param {string} id
 * @param {Prisma.UserUpdateInput} updateBody
 * @returns {Promise<User>}
 */
const updateUserById = async (id, updateBody) => {
    return prisma_1.default.user.update({
        where: { id },
        data: updateBody,
    });
};
exports.updateUserById = updateUserById;
/**
 * Delete user by ID
 * @param {string} id
 * @returns {Promise<User>}
 */
const deleteUserById = async (id) => {
    return prisma_1.default.user.delete({
        where: { id },
    });
};
exports.deleteUserById = deleteUserById;
