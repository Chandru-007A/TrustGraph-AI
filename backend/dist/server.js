"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const config_1 = __importDefault(require("./config/config"));
const logger_1 = __importDefault(require("./utils/logger"));
const database_1 = require("./utils/database");
let server;
const startServer = async () => {
    // Connect to Supabase PostgreSQL using the retry logic
    await (0, database_1.connectDB)();
    server = app_1.default.listen(config_1.default.port, () => {
        logger_1.default.info(`🚀 Server is running on port ${config_1.default.port} in ${config_1.default.env} mode`);
    });
};
startServer();
const exitHandler = async () => {
    if (server) {
        server.close(async () => {
            logger_1.default.info('Server closed');
            await (0, database_1.disconnectDB)(); // Gracefully disconnect Prisma
            process.exit(1);
        });
    }
    else {
        await (0, database_1.disconnectDB)();
        process.exit(1);
    }
};
const unexpectedErrorHandler = (error) => {
    logger_1.default.error('Unexpected error', error);
    exitHandler();
};
process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);
process.on('SIGTERM', () => {
    logger_1.default.info('SIGTERM received');
    if (server) {
        server.close(async () => {
            logger_1.default.info('Server closed gracefully');
            await (0, database_1.disconnectDB)();
            process.exit(0);
        });
    }
});
process.on('SIGINT', () => {
    logger_1.default.info('SIGINT received');
    if (server) {
        server.close(async () => {
            logger_1.default.info('Server closed gracefully');
            await (0, database_1.disconnectDB)();
            process.exit(0);
        });
    }
});
