import app from './app';
import config from './config/config';
import logger from './utils/logger';
import { connectDB, disconnectDB } from './utils/database';
import { arcWorker } from './engine/blockchain/arc.worker';

let server: any;

const startServer = async () => {
  // Connect to Supabase PostgreSQL using the retry logic
  await connectDB();

  server = app.listen(config.port, () => {
    logger.info(`🚀 Server is running on port ${config.port} in ${config.env} mode`);
    // Start background jobs
    arcWorker.start();
  });
};

startServer();

const exitHandler = async () => {
  if (server) {
    server.close(async () => {
      logger.info('Server closed');
      arcWorker.stop();
      await disconnectDB(); // Gracefully disconnect Prisma
      process.exit(1);
    });
  } else {
    arcWorker.stop();
    await disconnectDB();
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error: Error) => {
  logger.error('Unexpected error', error);
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', (error: Error) => {
  logger.warn('Unhandled Rejection (ignored to prevent crash)', error);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close(async () => {
      logger.info('Server closed gracefully');
      arcWorker.stop();
      await disconnectDB();
      process.exit(0);
    });
  }
});

process.on('SIGINT', () => {
  logger.info('SIGINT received');
  if (server) {
    server.close(async () => {
      logger.info('Server closed gracefully');
      arcWorker.stop();
      await disconnectDB();
      process.exit(0);
    });
  }
});
