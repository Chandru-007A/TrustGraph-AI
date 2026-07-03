"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectDB = exports.connectDB = void 0;
const prisma_1 = __importDefault(require("./prisma"));
const logger_1 = __importDefault(require("./logger"));
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;
/**
 * Connect to the database with exponential backoff / retry logic.
 */
const connectDB = async (retries = MAX_RETRIES) => {
    try {
        await prisma_1.default.$connect();
        logger_1.default.info('✅ Successfully connected to Supabase PostgreSQL via Prisma');
    }
    catch (error) {
        logger_1.default.error(`❌ Failed to connect to the database. Retries left: ${retries}`, error.message);
        if (retries === 0) {
            logger_1.default.error('🚨 Max retries reached. Exiting application.');
            process.exit(1);
        }
        setTimeout(() => (0, exports.connectDB)(retries - 1), RETRY_DELAY_MS);
    }
};
exports.connectDB = connectDB;
/**
 * Disconnect from the database gracefully.
 */
const disconnectDB = async () => {
    try {
        await prisma_1.default.$disconnect();
        logger_1.default.info('🛑 Successfully disconnected from Supabase PostgreSQL');
    }
    catch (error) {
        logger_1.default.error('❌ Error during database disconnection', error.message);
    }
};
exports.disconnectDB = disconnectDB;
