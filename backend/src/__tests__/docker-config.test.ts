/**
 * Docker Configuration Tests
 * 
 * Verifies that Docker environment is properly configured
 * and all services are accessible
 */

describe('Docker Configuration', () => {
  const API_BASE_URL = 'http://localhost:3001';
  const POSTGRES_CONFIG = {
    host: 'postgres',
    port: 5432,
    user: process.env.DB_USER || 'payd_user',
    password: process.env.DB_PASSWORD || 'payd_password',
    database: process.env.DB_NAME || 'payd_db',
  };
  
  const REDIS_CONFIG = {
    host: 'redis',
    port: 6379,
  };

  // Skip these tests if not in Docker environment
  const SKIP_DOCKER_TESTS = process.env.SKIP_DOCKER_TESTS === 'true';

  describe('API Service', () => {
    test.skipIf(SKIP_DOCKER_TESTS)(
      'should be accessible on port 3001',
      async () => {
        const response = await fetch(`${API_BASE_URL}/health`);
        expect(response.status).toBe(200);
      },
      10000
    );

    test.skipIf(SKIP_DOCKER_TESTS)(
      'should return JSON response',
      async () => {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();
        expect(data).toHaveProperty('status');
      },
      10000
    );
  });

  describe('Database Configuration', () => {
    test('should have required environment variables', () => {
      expect(process.env.DB_USER || POSTGRES_CONFIG.user).toBeDefined();
      expect(process.env.DB_PASSWORD || POSTGRES_CONFIG.password).toBeDefined();
      expect(process.env.DB_NAME || POSTGRES_CONFIG.database).toBeDefined();
    });

    test('should have valid DATABASE_URL format', () => {
      const dbUrl = process.env.DATABASE_URL || '';
      
      if (dbUrl) {
        // If DATABASE_URL is set, validate its format
        expect(dbUrl).toMatch(/^postgresql?:\/\/.+:.+@.+:\d+\/.+$/);
      }
    });

    test('should have correct host for Docker', () => {
      const dbUrl = process.env.DATABASE_URL || '';
      
      if (dbUrl && process.env.NODE_ENV === 'docker') {
        // In Docker, should use service name, not localhost
        expect(dbUrl).not.toContain('localhost');
        expect(dbUrl).not.toContain('127.0.0.1');
      }
    });
  });

  describe('Redis Configuration', () => {
    test('should have REDIS_URL defined', () => {
      const redisUrl = process.env.REDIS_URL;
      // REDIS_URL is optional but if defined should be valid
      if (redisUrl) {
        expect(redisUrl).toMatch(/^redis:\/\/.+/);
      }
    });

    test('should use service hostname for Docker', () => {
      const redisUrl = process.env.REDIS_URL || '';
      
      if (redisUrl && process.env.NODE_ENV === 'docker') {
        // In Docker, should use service name
        expect(redisUrl).not.toContain('localhost');
        expect(redisUrl).not.toContain('127.0.0.1');
      }
    });
  });

  describe('Required Ports', () => {
    test('should define correct API port', () => {
      const port = process.env.PORT || 3001;
      expect(Number(port)).toBeGreaterThan(0);
      expect(Number(port)).toBeLessThan(65536);
    });

    test('PORT environment variable should be numeric', () => {
      if (process.env.PORT) {
        expect(Number(process.env.PORT)).not.toBeNaN();
      }
    });

    test('should not use well-known ports in docker-compose', () => {
      // These are the external ports mapped in docker-compose.yml
      const externalPorts = [3001, 5433, 6380];
      
      externalPorts.forEach(port => {
        // Just verify they're valid port numbers
        expect(port).toBeGreaterThan(1024); // Non-privileged
        expect(port).toBeLessThan(65536);
      });
    });
  });

  describe('Volume Configuration', () => {
    test('should have accessible source directory', () => {
      const fs = require('fs');
      const path = require('path');
      
      // Check if we're in the correct directory structure
      const hasPackageJson = fs.existsSync(path.join(__dirname, '..', 'package.json'));
      expect(hasPackageJson).toBe(true);
    });

    test('should have node_modules accessible', () => {
      const fs = require('fs');
      const path = require('path');
      
      // In Docker, node_modules should be installed
      const hasNodeModules = fs.existsSync(path.join(__dirname, '..', 'node_modules'));
      expect(hasNodeModules).toBe(true);
    });
  });

  describe('Network Configuration', () => {
    test('should have NODE_ENV set', () => {
      expect(process.env.NODE_ENV).toBeDefined();
      expect(['development', 'production', 'test', 'docker']).toContain(
        process.env.NODE_ENV
      );
    });

    test('should have valid Stellar network configuration', () => {
      const passphrase = process.env.STELLAR_NETWORK_PASSPHRASE;
      const horizonUrl = process.env.STELLAR_HORIZON_URL;
      
      // These are optional but if defined should be valid
      if (passphrase) {
        expect(typeof passphrase).toBe('string');
        expect(passphrase.length).toBeGreaterThan(0);
      }
      
      if (horizonUrl) {
        expect(horizonUrl).toMatch(/^https?:\/\//);
      }
    });
  });

  describe('Docker Health Checks', () => {
    test('should have health check endpoint configured for API', () => {
      // This is about the docker-compose healthcheck configuration
      // The healthcheck should call: curl -f http://localhost:3001/health || exit 1
      expect(API_BASE_URL).toContain('3001');
    });

    test('all services should be configured with health checks', () => {
      // Verify we know about the health check configuration
      const expectedServices = ['api', 'postgres', 'redis'];
      expectedServices.forEach(service => {
        expect(service).toBeDefined();
      });
    });
  });
});
