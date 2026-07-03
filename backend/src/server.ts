import app from './app';
import config from './config/config';
import logger from './utils/logger';
import { connectDB, disconnectDB } from './utils/database';

let server: any;

const startServer = async () => {
  // Connect to Supabase PostgreSQL using the retry logic
  await connectDB();

  server = app.listen(config.port, () => {
    logger.info(`🚀 Server is running on port ${config.port} in ${config.env} mode`);
  });
};

startServer();

const exitHandler = async () => {
  if (server) {
    server.close(async () => {
      logger.info('Server closed');
      await disconnectDB(); // Gracefully disconnect Prisma
      process.exit(1);
    });
  } else {
    await disconnectDB();
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error: Error) => {
  logger.error('Unexpected error', error);
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close(async () => {
      logger.info('Server closed gracefully');
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
      await disconnectDB();
      process.exit(0);
    });
  }
});
