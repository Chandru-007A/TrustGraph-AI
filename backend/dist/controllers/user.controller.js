"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updateUser = exports.getUser = exports.getUsers = exports.createUser = void 0;
const http_status_1 = __importDefault(require("http-status"));
const catchAsync_1 = __importDefault(require("../utils/catchAsync"));
const userService = __importStar(require("../services/user.service"));
const ApiError_1 = __importDefault(require("../utils/ApiError"));
const ApiResponse_1 = __importDefault(require("../utils/ApiResponse"));
exports.createUser = (0, catchAsync_1.default)(async (req, res) => {
    const user = await userService.createUser(req.body);
    const response = new ApiResponse_1.default(http_status_1.default.CREATED, 'User created successfully', user);
    res.status(response.statusCode).json(response);
});
exports.getUsers = (0, catchAsync_1.default)(async (req, res) => {
    const users = await userService.queryUsers();
    const response = new ApiResponse_1.default(http_status_1.default.OK, 'Users retrieved successfully', users);
    res.status(response.statusCode).json(response);
});
exports.getUser = (0, catchAsync_1.default)(async (req, res) => {
    const user = await userService.getUserById(req.params.id);
    if (!user) {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
    }
    const response = new ApiResponse_1.default(http_status_1.default.OK, 'User retrieved successfully', user);
    res.status(response.statusCode).json(response);
});
exports.updateUser = (0, catchAsync_1.default)(async (req, res) => {
    // Check if user exists before attempting update (Prisma throws P2025 otherwise)
    const userExists = await userService.getUserById(req.params.id);
    if (!userExists) {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
    }
    const user = await userService.updateUserById(req.params.id, req.body);
    const response = new ApiResponse_1.default(http_status_1.default.OK, 'User updated successfully', user);
    res.status(response.statusCode).json(response);
});
exports.deleteUser = (0, catchAsync_1.default)(async (req, res) => {
    const userExists = await userService.getUserById(req.params.id);
    if (!userExists) {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
    }
    await userService.deleteUserById(req.params.id);
    const response = new ApiResponse_1.default(http_status_1.default.OK, 'User deleted successfully');
    res.status(response.statusCode).json(response);
});
