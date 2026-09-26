import dotenv from 'dotenv';
import { createServer } from 'http';
import { initTracing, sdk } from './utils/tracing.js';

dotenv.config();
initTracing();

const { default: app } = await import('./app.js');
const { default: logger } = await import('./utils/logger.js');
const { default: config } = await import('./config/index.js');
const { assertJwtSecretsSecure } = await import('./utils/jwtSecurity.js');
const { initializeSocket } = await import('./services/socketService.js');
const { startWorkers, stopWorkers } = await import('./workers/index.js');
const { pool } = await import('./config/database.js');
const { rateLimitService } = await import('./services/rateLimitService.js');
const { ThrottlingService } = await import('./services/throttlingService.js');
const { setShuttingDown, waitForInFlightRequests, getInFlightRequests } = await import('./utils/lifecycle.js');

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

let shuttingDown = false;

// Graceful shutdown handler (#1048)
const shutdown = async (signal: string) => {
  if (shuttingDown) {
    logger.warn(`Shutdown already in progress, ignoring ${signal}`);
    return;
  }
  shuttingDown = true;
  setShuttingDown(true);

  const shutdownStart = Date.now();
  logger.info(`${signal} received — starting graceful shutdown...`, { timestamp: new Date().toISOString() });

  // Set 30-second timeout for forced exit
  const shutdownTimeout = setTimeout(() => {
    logger.error('Forced shutdown after 30-second timeout', {
      elapsedMs: Date.now() - shutdownStart,
    });
    process.exit(1);
  }, 30000);

  try {
    // Step 1: Stop accepting new HTTP connections
    logger.info('Step 1/7: Closing HTTP server (draining existing connections)...');
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    logger.info('HTTP server closed', { elapsedMs: Date.now() - shutdownStart });

    logger.info('Step 2/7: Waiting for in-flight HTTP requests to finish...', {
      inFlightRequests: getInFlightRequests(),
    });
    const drained = await waitForInFlightRequests(25000);
    logger.info('HTTP request drain complete', {
      drained,
      inFlightRequests: getInFlightRequests(),
      elapsedMs: Date.now() - shutdownStart,
    });

    // Step 2: Stop BullMQ workers (finish current jobs)
    logger.info('Step 3/7: Stopping BullMQ workers...');
    await stopWorkers();
    logger.info('Workers stopped', { elapsedMs: Date.now() - shutdownStart });

    // Step 3: Close database pool
    logger.info('Step 4/7: Closing database connection pool...');
    await pool.end();
    logger.info('Database pool closed', { elapsedMs: Date.now() - shutdownStart });

    // Step 4: Clean up rate limit service
    logger.info('Step 5/7: Cleaning up rate limit service...');
    await rateLimitService.resetRateLimit('shutdown', 'api');
    logger.info('Rate limit service cleaned up', { elapsedMs: Date.now() - shutdownStart });

    // Step 5: Reset throttling service singleton
    logger.info('Step 6/7: Resetting throttling service...');
    ThrottlingService.resetInstance();
    logger.info('Throttling service reset', { elapsedMs: Date.now() - shutdownStart });

    // Step 6: Shutdown tracing SDK
    if (sdk) {
      logger.info('Step 7/7: Shutting down tracing SDK...');
      await sdk.shutdown();
      logger.info('Tracing SDK shut down', { elapsedMs: Date.now() - shutdownStart });
    }

    clearTimeout(shutdownTimeout);
    logger.info('Graceful shutdown complete', {
      totalElapsedMs: Date.now() - shutdownStart,
      timestamp: new Date().toISOString(),
    });
    process.exit(0);
  } catch (err) {
    logger.error('Error during graceful shutdown', {
      error: err,
      elapsedMs: Date.now() - shutdownStart,
    });
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Prevent unhandled rejections from crashing the process silently
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise rejection', { error: reason });
});
