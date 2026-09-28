import crypto from 'crypto';
import { parseEnv } from '../env.js';

const generateSecret = () => crypto.randomBytes(48).toString('hex');

const buildEnv = () => ({
  PORT: '3001',
  DATABASE_URL: 'postgres://localhost:5432/payd_test',
  NODE_ENV: 'test' as const,
  JWT_SECRET: generateSecret(),
  JWT_REFRESH_SECRET: generateSecret(),
  CORS_ORIGIN: 'http://localhost:5173',
  FRONTEND_URL: 'http://localhost:5173',
  EMAIL_PROVIDER: 'resend' as const,
  EMAIL_FROM_ADDRESS: 'test@example.com',
  EMAIL_FROM_NAME: 'Test App',
  STELLAR_NETWORK: 'testnet' as const,
  STELLAR_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
  STELLAR_HORIZON_URL: 'https://horizon-testnet.stellar.org',
});

describe('parseEnv', () => {
  describe('JWT Configuration', () => {
    it('accepts strong JWT secrets from environment variables', () => {
      const env = buildEnv();

      const parsed = parseEnv(env);

      expect(parsed.JWT_SECRET).toBe(env.JWT_SECRET);
      expect(parsed.JWT_REFRESH_SECRET).toBe(env.JWT_REFRESH_SECRET);
    });

    it('rejects missing JWT access secrets', () => {
      const env = buildEnv() as NodeJS.ProcessEnv;
      delete env.JWT_SECRET;

      expect(() => parseEnv(env)).toThrow(/JWT_SECRET must be set in the environment/);
    });

    it('rejects JWT secrets shorter than 32 characters', () => {
      const env = {
        ...buildEnv(),
        JWT_SECRET: 'short-secret-less-than-32-chars',
      };

      expect(() => parseEnv(env)).toThrow(/JWT_SECRET must be at least 32 characters long/);
    });

    it('rejects placeholder JWT secrets', () => {
      const env = {
        ...buildEnv(),
        JWT_SECRET: 'replace-with-a-long-random-secret',
      };

      expect(() => parseEnv(env)).toThrow(/JWT_SECRET must be replaced with a strong random value/);
    });

    it('rejects common default JWT values', () => {
      const invalidSecrets = [
        'dev-jwt-secret',
        'dev-jwt-refresh-secret',
        'your_jwt_secret',
        'replace-with-a-different-long-random-secret',
      ];

      invalidSecrets.forEach((secret) => {
        const env = {
          ...buildEnv(),
          JWT_SECRET: secret,
        };

        expect(() => parseEnv(env)).toThrow(
          /JWT_SECRET must be replaced with a strong random value/
        );
      });
    });

    it('rejects reused refresh secrets', () => {
      const sharedSecret = generateSecret();
      const env = {
        ...buildEnv(),
        JWT_SECRET: sharedSecret,
        JWT_REFRESH_SECRET: sharedSecret,
      };

      expect(() => parseEnv(env)).toThrow(/JWT_REFRESH_SECRET must be different from JWT_SECRET/);
    });

    it('requires JWT_REFRESH_SECRET to be different from JWT_SECRET', () => {
      const env = buildEnv();
      const parsed = parseEnv(env);

      expect(parsed.JWT_SECRET).not.toBe(parsed.JWT_REFRESH_SECRET);
    });
  });

  describe('Database Configuration', () => {
    it('accepts valid DATABASE_URL connection string', () => {
      const env = buildEnv();
      const parsed = parseEnv(env);

      expect(parsed.DATABASE_URL).toBe(env.DATABASE_URL);
    });

    it('uses default DATABASE_URL if not provided', () => {
      const env = buildEnv() as NodeJS.ProcessEnv;
      delete env.DATABASE_URL;

      const parsed = parseEnv(env);

      expect(parsed.DATABASE_URL).toBe('postgres://localhost:5432/payd_test');
    });
  });

  describe('Email Configuration', () => {
    it('accepts valid email provider values', () => {
      const validProviders = ['resend', 'sendgrid'];

      validProviders.forEach((provider) => {
        const env = {
          ...buildEnv(),
          EMAIL_PROVIDER: provider,
        };

        const parsed = parseEnv(env);
        expect(parsed.EMAIL_PROVIDER).toBe(provider);
      });
    });

    it('rejects invalid email provider values', () => {
      const env = {
        ...buildEnv(),
        EMAIL_PROVIDER: 'mailchimp',
      };

      expect(() => parseEnv(env)).toThrow();
    });

    it('uses default email provider if not specified', () => {
      const { EMAIL_PROVIDER, ...withoutProvider } = buildEnv();
      const parsed = parseEnv(withoutProvider as NodeJS.ProcessEnv);

      expect(parsed.EMAIL_PROVIDER).toBe('resend');
    });

    it('accepts EMAIL_FROM_ADDRESS and EMAIL_FROM_NAME', () => {
      const env = buildEnv();
      const parsed = parseEnv(env);

      expect(parsed.EMAIL_FROM_ADDRESS).toBe(env.EMAIL_FROM_ADDRESS);
      expect(parsed.EMAIL_FROM_NAME).toBe(env.EMAIL_FROM_NAME);
    });
  });

  describe('CORS Configuration', () => {
    it('accepts CORS_ORIGIN configuration', () => {
      const env = buildEnv();
      const parsed = parseEnv(env);

      expect(parsed.CORS_ORIGIN).toBe(env.CORS_ORIGIN);
    });

    it('accepts CORS_ALLOWED_ORIGINS comma-separated list', () => {
      const corsOrigins = 'https://staging.payd.io,https://app.payd.io';
      const env = {
        ...buildEnv(),
        CORS_ALLOWED_ORIGINS: corsOrigins,
      };

      const parsed = parseEnv(env);
      expect(parsed.CORS_ALLOWED_ORIGINS).toBe(corsOrigins);
    });
  });

  describe('Stellar Network Configuration', () => {
    it('accepts valid Stellar network values', () => {
      const validNetworks = ['testnet', 'mainnet', 'public'];

      validNetworks.forEach((network) => {
        const env = {
          ...buildEnv(),
          STELLAR_NETWORK: network,
        };

        const parsed = parseEnv(env);
        expect(parsed.STELLAR_NETWORK).toBe(network);
      });
    });

    it('rejects invalid Stellar network values', () => {
      const env = {
        ...buildEnv(),
        STELLAR_NETWORK: 'invalid-network',
      };

      expect(() => parseEnv(env)).toThrow();
    });

    it('accepts Stellar network passphrases', () => {
      const env = buildEnv();
      const parsed = parseEnv(env);

      expect(parsed.STELLAR_NETWORK_PASSPHRASE).toBe(env.STELLAR_NETWORK_PASSPHRASE);
    });

    it('accepts Stellar Horizon URL configuration', () => {
      const env = buildEnv();
      const parsed = parseEnv(env);

      expect(parsed.STELLAR_HORIZON_URL).toBe(env.STELLAR_HORIZON_URL);
    });
  });

  describe('Node Environment Configuration', () => {
    it('accepts valid NODE_ENV values', () => {
      const validEnvs = ['development', 'production', 'test'];

      validEnvs.forEach((nodeEnv) => {
        const env = {
          ...buildEnv(),
          NODE_ENV: nodeEnv,
        };

        const parsed = parseEnv(env);
        expect(parsed.NODE_ENV).toBe(nodeEnv);
      });
    });

    it('rejects invalid NODE_ENV values', () => {
      const env = {
        ...buildEnv(),
        NODE_ENV: 'staging',
      };

      expect(() => parseEnv(env)).toThrow();
    });

    it('uses development as default NODE_ENV', () => {
      const { NODE_ENV, ...withoutNodeEnv } = buildEnv();
      const parsed = parseEnv(withoutNodeEnv as NodeJS.ProcessEnv);

      expect(parsed.NODE_ENV).toBe('development');
    });
  });

  describe('Rate Limiting & Throttling Configuration', () => {
    it('accepts throttling rate configuration', () => {
      const env = {
        ...buildEnv(),
        THROTTLING_TPM: '200',
      };

      const parsed = parseEnv(env);
      expect(parsed.THROTTLING_TPM).toBe('200');
    });

    it('accepts rate limit window and max configuration', () => {
      const env = {
        ...buildEnv(),
        RATE_LIMIT_AUTH_WINDOW_MS: '600000',
        RATE_LIMIT_AUTH_MAX: '5',
        RATE_LIMIT_API_WINDOW_MS: '30000',
        RATE_LIMIT_API_MAX: '50',
      };

      const parsed = parseEnv(env);
      expect(parsed.RATE_LIMIT_AUTH_WINDOW_MS).toBe('600000');
      expect(parsed.RATE_LIMIT_AUTH_MAX).toBe('5');
      expect(parsed.RATE_LIMIT_API_WINDOW_MS).toBe('30000');
      expect(parsed.RATE_LIMIT_API_MAX).toBe('50');
    });
  });

  describe('PORT Configuration', () => {
    it('accepts valid port numbers as strings', () => {
      const validPorts = ['3000', '3001', '8000', '8080'];

      validPorts.forEach((port) => {
        const env = {
          ...buildEnv(),
          PORT: port,
        };

        const parsed = parseEnv(env);
        expect(parsed.PORT).toBe(port);
      });
    });

    it('uses default port if not specified', () => {
      const { PORT, ...withoutPort } = buildEnv();
      const parsed = parseEnv(withoutPort as NodeJS.ProcessEnv);

      expect(parsed.PORT).toBe('3000');
    });
  });

  describe('Redis Configuration', () => {
    it('accepts Redis URL configuration', () => {
      const env = {
        ...buildEnv(),
        REDIS_URL: 'redis://localhost:6379',
      };

      const parsed = parseEnv(env);
      expect(parsed.REDIS_URL).toBe('redis://localhost:6379');
    });

    it('allows Redis URL to be optional', () => {
      const { REDIS_URL, ...withoutRedis } = buildEnv();
      const parsed = parseEnv(withoutRedis as NodeJS.ProcessEnv);

      expect(parsed.REDIS_URL).toBeUndefined();
    });
  });

  describe('Full Configuration Integration', () => {
    it('parses complete valid environment configuration', () => {
      const env = buildEnv();

      const parsed = parseEnv(env);

      expect(parsed).toHaveProperty('PORT');
      expect(parsed).toHaveProperty('DATABASE_URL');
      expect(parsed).toHaveProperty('NODE_ENV');
      expect(parsed).toHaveProperty('JWT_SECRET');
      expect(parsed).toHaveProperty('JWT_REFRESH_SECRET');
      expect(parsed).toHaveProperty('CORS_ORIGIN');
      expect(parsed).toHaveProperty('EMAIL_PROVIDER');
      expect(parsed).toHaveProperty('STELLAR_NETWORK');
    });

    it('preserves configuration values through parsing', () => {
      const env = buildEnv();

      const parsed = parseEnv(env);

      expect(parsed.PORT).toBe(env.PORT);
      expect(parsed.DATABASE_URL).toBe(env.DATABASE_URL);
      expect(parsed.NODE_ENV).toBe(env.NODE_ENV);
      expect(parsed.CORS_ORIGIN).toBe(env.CORS_ORIGIN);
    });
  });
});
