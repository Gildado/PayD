import dotenv from 'dotenv';
import { createServer } from 'http';
import app from './app.js';
import logger from './utils/logger.js';
import config from './config/index.js';
import { assertJwtSecretsSecure } from './utils/jwtSecurity.js';
import { initializeSocket } from './services/socketService.js';
import { startWorkers, stopWorkers } from './workers/index.js';
import { pool } from './config/database.js';
import { rateLimitService } from './services/rateLimitService.js';
import { ThrottlingService } from './services/throttlingService.js';
import { sdk } from './utils/tracing.js';

dotenv.config();

assertJwtSecretsSecure({
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
});

const server = createServer(app);

initializeSocket(server);

startWorkers();

const PORT = config.port || process.env.PORT || 4000;

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`Health check: http://localhost:${PORT}/health}`);
  logger.info(`Contract registry: http://localhost:${PORT}/api/contracts`);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`${signal} received — starting graceful shutdown...`);

  server.close(() => {
    logger.info('HTTP server closed');
  });

  const shutdownTimeout = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);

  try {
    await stopWorkers();
    logger.info('Workers stopped');

    await pool.end();
    logger.info('Database pool closed');

    await rateLimitService.resetRateLimit('shutdown', 'api');

    ThrottlingService.resetInstance();

    if (sdk) {
      await sdk.shutdown();
      logger.info('Tracing SDK shut down');
    }

    clearTimeout(shutdownTimeout);
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error('Error during graceful shutdown', { error: err });
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Prevent unhandled rejections from crashing the process silently
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise rejection', { error: reason });
});
