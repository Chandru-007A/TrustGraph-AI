"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPasswordMatch = exports.hashPassword = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const SALT_ROUNDS = 12; // bcrypt work factor — 12 is production-grade (2^12 iterations)
/**
 * Hash a plain-text password using bcrypt.
 * Never call this with an already-hashed value.
 */
const hashPassword = async (password) => {
    const salt = await bcryptjs_1.default.genSalt(SALT_ROUNDS);
    return bcryptjs_1.default.hash(password, salt);
};
exports.hashPassword = hashPassword;
/**
 * Compare a plain-text password against a stored bcrypt hash.
 * Returns true if they match, false otherwise.
 * bcrypt.compare is timing-safe — safe against timing attacks.
 */
const isPasswordMatch = async (password, hash) => {
    return bcryptjs_1.default.compare(password, hash);
};
exports.isPasswordMatch = isPasswordMatch;
