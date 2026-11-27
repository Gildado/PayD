/**
 * Integration Tests for Security Headers on Key Routes
 * 
 * Acceptance Criteria: Header test passes
 */

import request from 'supertest';
import app from '../app.js';

describe('Security Headers Integration Tests', () => {
  const keyRoutes = [
    { method: 'get', path: '/health' },
    { method: 'get', path: '/api/v1/health' },
    { method: 'get', path: '/metrics' },
    { method: 'get', path: '/api-docs' },
    { method: 'get', path: '/.well-known/stellar.toml' },
  ];

  describe('HSTS Header', () => {
    it('sets Strict-Transport-Security in production on all key routes', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      for (const route of keyRoutes) {
        const response = await request(app)[route.method](route.path);
        
        expect(response.headers['strict-transport-security']).toBeDefined();
        expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
        expect(response.headers['strict-transport-security']).toContain('includeSubDomains');
      }

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('X-Content-Type-Options Header', () => {
    it('sets nosniff on all key routes', async () => {
      for (const route of keyRoutes) {
        const response = await request(app)[route.method](route.path);
        
        expect(response.headers['x-content-type-options']).toBe('nosniff');
      }
    });
  });

  describe('X-Frame-Options Header', () => {
    it('sets DENY on all key routes', async () => {
      for (const route of keyRoutes) {
        const response = await request(app)[route.method](route.path);
        
        expect(response.headers['x-frame-options']).toBe('DENY');
      }
    });
  });

  describe('Content-Security-Policy Header', () => {
    it('sets restrictive CSP on all key routes', async () => {
      for (const route of keyRoutes) {
        const response = await request(app)[route.method](route.path);
        
        expect(response.headers['content-security-policy']).toBeDefined();
        expect(response.headers['content-security-policy']).toContain("default-src 'self'");
        expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
      }
    });
  });

  describe('X-XSS-Protection Header', () => {
    it('enables XSS protection on all key routes', async () => {
      for (const route of keyRoutes) {
        const response = await request(app)[route.method](route.path);
        
        expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      }
    });
  });

  describe('Referrer-Policy Header', () => {
    it('sets strict-origin-when-cross-origin on all key routes', async () => {
      for (const route of keyRoutes) {
        const response = await request(app)[route.method](route.path);
        
        expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      }
    });
  });

  describe('Permissions-Policy Header', () => {
    it('restricts unnecessary features on all key routes', async () => {
      for (const route of keyRoutes) {
        const response = await request(app)[route.method](route.path);
        
        const policy = response.headers['permissions-policy'];
        expect(policy).toBeDefined();
        expect(policy).toContain('geolocation=()');
        expect(policy).toContain('camera=()');
        expect(policy).toContain('microphone=()');
      }
    });
  });

  describe('All Security Headers Together', () => {
    it('applies all security headers to health endpoint', async () => {
      const response = await request(app).get('/health');
      
      // Verify all critical security headers are present
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['referrer-policy']).toBeDefined();
      expect(response.headers['permissions-policy']).toBeDefined();
    });

    it('applies all security headers to API v1 routes', async () => {
      const response = await request(app).get('/api/v1/health');
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['referrer-policy']).toBeDefined();
      expect(response.headers['permissions-policy']).toBeDefined();
    });
  });

  describe('Documented Exceptions', () => {
    it('stellar.toml route allows CORS for SEP-0001 compliance', async () => {
      const response = await request(app).get('/.well-known/stellar.toml');
      
      // This route needs Access-Control-Allow-Origin: * for Stellar protocol
      expect(response.headers['access-control-allow-origin']).toBe('*');
      
      // But still has other security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });
  });
});
