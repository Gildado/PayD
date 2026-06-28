import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Stellar Configuration
  stellar: {
    networkPassphrase:
      process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
    horizonUrl: process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
  },

  // SDS Configuration
  sds: {
    enabled: process.env.SDS_ENABLE === 'true',
    apiKey: process.env.SDS_API_KEY,
    endpoint: process.env.SDS_ENDPOINT || 'https://sds-api.stellar.org',
    timeout: parseInt(process.env.SDS_TIMEOUT || '30000', 10),
    retryAttempts: parseInt(process.env.SDS_RETRY_ATTEMPTS || '3', 10),
    retryDelay: parseInt(process.env.SDS_RETRY_DELAY || '1000', 10),
  },

  // Soroban Event Indexer Configuration
  sorobanIndexer: {
    enabled: process.env.SOROBAN_INDEXER_ENABLE === 'true',
    pollDelayMs: parseInt(process.env.SOROBAN_INDEXER_POLL_DELAY || '10000', 10),
    batchSize: parseInt(process.env.SOROBAN_INDEXER_BATCH_SIZE || '50', 10),
    targetContracts: process.env.SOROBAN_TARGET_CONTRACTS 
      ? process.env.SOROBAN_TARGET_CONTRACTS.split(',').map(id => id.trim())
      : [],
  },

  // Database Configuration
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
  },

  // Caching Configuration
  cache: {
    enabled: process.env.ENABLE_CACHING === 'true',
    ttl: parseInt(process.env.CACHE_TTL || '3600', 10),
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  // Monitoring / Observability
  monitoring: {
    // Elasticsearch (ELK stack)
    elasticsearchEnabled: process.env.ELASTICSEARCH_ENABLED === 'true',
    elasticsearchUrl: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    elasticsearchUsername: process.env.ELASTICSEARCH_USERNAME,
    elasticsearchPassword: process.env.ELASTICSEARCH_PASSWORD,
    // OpenTelemetry distributed tracing
    tracingEnabled: process.env.TRACING_ENABLED === 'true',
    otlpEndpoint: process.env.OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    // Prometheus metrics
    metricsToken: process.env.METRICS_TOKEN,
  },
};

export default config;
