// src/types/express.d.ts
// Augments Express's Request interface globally so req.user is always typed.
// This eliminates all (req as any).user casts across the codebase.

import { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: Omit<User, 'password'>;
    }
  }
}
