"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = exports.generateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../config/config"));
/**
 * Generate a signed JWT.
 * Role is embedded in the payload so authorization middleware
 * can enforce RBAC without an additional database round-trip.
 */
const generateToken = (userId, role, expires, type) => {
    const payload = {
        sub: userId,
        role,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(expires.getTime() / 1000),
        type,
    };
    return jsonwebtoken_1.default.sign(payload, config_1.default.jwt.secret);
};
exports.generateToken = generateToken;
/**
 * Verify and decode a JWT.
 * Throws a clean error if the token is expired, tampered with, or malformed.
 */
const verifyToken = (token) => {
    try {
        return jsonwebtoken_1.default.verify(token, config_1.default.jwt.secret);
    }
    catch (err) {
        if (err.name === 'TokenExpiredError') {
            throw new Error('Token has expired');
        }
        throw new Error('Invalid or malformed token');
    }
};
exports.verifyToken = verifyToken;
