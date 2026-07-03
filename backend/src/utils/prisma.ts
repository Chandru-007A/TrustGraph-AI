import { PrismaClient } from '@prisma/client';
import config from '../config/config';

// Define a type for the global object to avoid TypeScript errors
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Instantiate the Prisma Client with query logging enabled in development mode
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: config.env === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

// In development, save the client on the global object to prevent connection 
// exhaustion caused by hot-reloading.
if (config.env !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
