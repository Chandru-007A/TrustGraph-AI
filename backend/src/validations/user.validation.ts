import { z } from 'zod';
import { Role } from '@prisma/client';

export const createUserSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    did: z.string().optional(),
    displayName: z.string().optional(),
    role: z.nativeEnum(Role).optional(),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID format'),
  }),
  body: z.object({
    email: z.string().email('Invalid email address').optional(),
    did: z.string().optional(),
    displayName: z.string().optional(),
    role: z.nativeEnum(Role).optional(),
  }).strict().refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  }),
});

export const getUserSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID format'),
  }),
});

export const deleteUserSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID format'),
  }),
});
