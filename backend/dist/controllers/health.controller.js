"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkHealth = void 0;
const http_status_1 = __importDefault(require("http-status"));
const catchAsync_1 = __importDefault(require("../utils/catchAsync"));
const health_service_1 = require("../services/health.service");
exports.checkHealth = (0, catchAsync_1.default)(async (req, res) => {
    const dbStatus = await (0, health_service_1.checkDatabaseHealth)();
    // Specific response format as requested
    const responseData = {
        status: dbStatus ? 'healthy' : 'unhealthy',
        database: dbStatus ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    };
    const statusCode = dbStatus ? http_status_1.default.OK : http_status_1.default.SERVICE_UNAVAILABLE;
    res.status(statusCode).json(responseData);
});
