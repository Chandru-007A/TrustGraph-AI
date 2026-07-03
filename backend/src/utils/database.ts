import prisma from './prisma';
import logger from './logger';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

/**
 * Connect to the database with exponential backoff / retry logic.
 */
export const connectDB = async (retries = MAX_RETRIES) => {
  try {
    await prisma.$connect();
    logger.info('✅ Successfully connected to Supabase PostgreSQL via Prisma');
  } catch (error: any) {
    logger.error(`❌ Failed to connect to the database. Retries left: ${retries}`, error.message);
    if (retries === 0) {
      logger.error('🚨 Max retries reached. Exiting application.');
      process.exit(1);
    }
    setTimeout(() => connectDB(retries - 1), RETRY_DELAY_MS);
  }
};

/**
 * Disconnect from the database gracefully.
 */
export const disconnectDB = async () => {
  try {
    await prisma.$disconnect();
    logger.info('🛑 Successfully disconnected from Supabase PostgreSQL');
  } catch (error: any) {
    logger.error('❌ Error during database disconnection', error.message);
  }
};
