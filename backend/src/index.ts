import dotenv from 'dotenv';
import app from './app.js';
import logger from './utils/logger.js';
import config from './config/index.js';

dotenv.config();

const PORT = config.port || process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  logger.info(`Contract registry: http://localhost:${PORT}/api/contracts`);
});
