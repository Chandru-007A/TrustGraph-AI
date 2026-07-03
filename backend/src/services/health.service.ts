import prisma from '../utils/prisma';
import logger from '../utils/logger';

/**
 * Check the database health by executing a simple query
 * @returns {Promise<boolean>}
 */
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    // Pinging the DB with a raw query to ensure the connection is active
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
};
