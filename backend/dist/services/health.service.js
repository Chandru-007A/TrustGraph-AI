"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDatabaseHealth = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Check the database health by executing a simple query
 * @returns {Promise<boolean>}
 */
const checkDatabaseHealth = async () => {
    try {
        // Pinging the DB with a raw query to ensure the connection is active
        await prisma_1.default.$queryRaw `SELECT 1`;
        return true;
    }
    catch (error) {
        logger_1.default.error('Database health check failed:', error);
        return false;
    }
};
exports.checkDatabaseHealth = checkDatabaseHealth;
