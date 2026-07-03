"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const health_controller_1 = require("../../controllers/health.controller");
const router = express_1.default.Router();
router.route('/').get(health_controller_1.checkHealth);
exports.default = router;
