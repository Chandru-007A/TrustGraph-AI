"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUserSchema = exports.getUserSchema = exports.updateUserSchema = exports.createUserSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.createUserSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email('Invalid email address'),
        did: zod_1.z.string().optional(),
        displayName: zod_1.z.string().optional(),
        role: zod_1.z.nativeEnum(client_1.Role).optional(),
    }),
});
exports.updateUserSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().uuid('Invalid user ID format'),
    }),
    body: zod_1.z.object({
        email: zod_1.z.string().email('Invalid email address').optional(),
        did: zod_1.z.string().optional(),
        displayName: zod_1.z.string().optional(),
        role: zod_1.z.nativeEnum(client_1.Role).optional(),
    }).strict().refine((data) => Object.keys(data).length > 0, {
        message: 'At least one field must be provided to update',
    }),
});
exports.getUserSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().uuid('Invalid user ID format'),
    }),
});
exports.deleteUserSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().uuid('Invalid user ID format'),
    }),
});
