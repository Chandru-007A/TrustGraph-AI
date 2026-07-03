"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const config_1 = __importDefault(require("../config/config"));
// Define a type for the global object to avoid TypeScript errors
const globalForPrisma = global;
// Instantiate the Prisma Client with query logging enabled in development mode
exports.prisma = globalForPrisma.prisma ||
    new client_1.PrismaClient({
        log: config_1.default.env === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
// In development, save the client on the global object to prevent connection 
// exhaustion caused by hot-reloading.
if (config_1.default.env !== 'production')
    globalForPrisma.prisma = exports.prisma;
exports.default = exports.prisma;
