import { Pool } from 'pg';
import dotenv from 'dotenv';
import { config, getPoolConfig } from './env.js';
import logger from '../utils/logger.js';
import { dbConnectionPool, dbQueryDuration } from '../utils/metrics.js';

dotenv.config();

const poolConfig = getPoolConfig();

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  min: poolConfig.min,
  max: poolConfig.max,
  idleTimeoutMillis: poolConfig.idleTimeoutMillis,
  connectionTimeoutMillis: poolConfig.connectionTimeoutMillis,
  statement_timeout: poolConfig.statementTimeout,
  query_timeout: poolConfig.queryTimeout,
});

pool.on('error', (err) => {
  logger.error('Unexpected database pool error', { error: err.message });
});

pool.on('acquire', () => {
  updatePoolMetrics();
});

pool.on('remove', () => {
  updatePoolMetrics();
});

function updatePoolMetrics() {
  try {
    dbConnectionPool.set({ state: 'total' }, pool.totalCount);
    dbConnectionPool.set({ state: 'idle' }, pool.idleCount);
    dbConnectionPool.set({ state: 'waiting' }, pool.waitingCount);
  } catch {
  }
}

export const query = (text: string, params?: any[]) => {
  const end = dbQueryDuration.startTimer({ operation: 'query', table: 'unknown' });
  const promise = pool.query(text, params);
  promise.finally(() => end()).catch(() => {});
  return promise;
};

export { pool };
export default pool;
