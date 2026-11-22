/**
 * Tests for Security Headers Middleware
 */

import request from 'supertest';
import express, { Express } from 'express';
import { securityHeadersMiddleware } from '../securityHeadersMiddleware.js';

describe('Security Headers Middleware', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(securityHeadersMiddleware);
    
    // Test routes
    app.get('/api/test', (_req, res) => {
      res.json({ message: 'ok' });
    });
    
    app.post('/api/test', express.json(), (_req, res) => {
      res.json({ message: 'created' });
    });
  });

  describe('HSTS Header', () => {
    it('sets Strict-Transport-Security in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app).get('/api/test');

      expect(response.headers['strict-transport-security']).toBe(
        'max-age=31536000; includeSubDomains; preload'
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('does not set HSTS in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const response = await request(app).get('/api/test');

      expect(response.headers['strict-transport-security']).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('X-Content-Type-Options Header', () => {
    it('sets nosniff on GET requests', async () => {
      const response = await request(app).get('/api/test');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('sets nosniff on POST requests', async () => {
      const response = await request(app)
        .post('/api/test')
        .send({ data: 'test' });

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('X-Frame-Options Header', () => {
    it('sets DENY to prevent clickjacking', async () => {
      const response = await request(app).get('/api/test');

      expect(response.headers['x-frame-options']).toBe('DENY');
    });
  });

  describe('Content-Security-Policy Header', () => {
    it('sets restrictive CSP policy', async () => {
      const response = await request(app).get('/api/test');

      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
      expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    });

    it('blocks inline scripts by default', async () => {
      const response = await request(app).get('/api/test');

      expect(response.headers['content-security-policy']).toContain("script-src 'self'");
      expect(response.headers['content-security-policy']).not.toContain("'unsafe-inline'");
    });
  });

  describe('X-XSS-Protection Header', () => {
    it('enables XSS protection with blocking mode', async () => {
      const response = await request(app).get('/api/test');

      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });

  describe('Referrer-Policy Header', () => {
    it('sets strict-origin-when-cross-origin', async () => {
      const response = await request(app).get('/api/test');

      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });
  });

  describe('Permissions-Policy Header', () => {
    it('disables unnecessary browser features', async () => {
      const response = await request(app).get('/api/test');

      const policy = response.headers['permissions-policy'];
      expect(policy).toBeDefined();
      expect(policy).toContain('geolocation=()');
      expect(policy).toContain('microphone=()');
      expect(policy).toContain('camera=()');
      expect(policy).toContain('payment=()');
    });
  });

  describe('All Routes', () => {
    it('applies security headers to all API routes', async () => {
      const routes = [
        '/api/test',
        '/api/test',
      ];

      for (const route of routes) {
        const response = await request(app).get(route);
        
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-frame-options']).toBe('DENY');
        expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      }
    });
  });
});
