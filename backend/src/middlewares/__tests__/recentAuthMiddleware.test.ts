/**
 * Tests for Recent Authentication Middleware
 */

import request from 'supertest';
import express, { Express } from 'express';
import { recentAuth, RecentAuthLimits } from '../recentAuthMiddleware.js';

describe('Recent Authentication Middleware', () => {
  let app: Express;

  describe('Token Age Validation', () => {
    beforeEach(() => {
      app = express();
      
      // Mock authenticateJWT middleware
      app.use((_req, res, next) => {
        // Simulate authenticated user with JWT payload
        (res as any).user = {
          id: 'user-123',
          iat: Math.floor(Date.now() / 1000) - 60, // Token issued 60 seconds ago
        };
        (res as any).req = { user: (res as any).user };
        next();
      });
      
      app.post('/api/sensitive', recentAuth(300), (_req, res) => {
        res.json({ message: 'action performed' });
      });
      
      app.post('/api/critical', recentAuth(RecentAuthLimits.CRITICAL), (_req, res) => {
        res.json({ message: 'critical action performed' });
      });
    });

    it('allows request when token is fresh', async () => {
      // Mock fresh token (issued 30 seconds ago, within 5 minute limit)
      app = express();
      app.use((req, _res, next) => {
        req.user = {
          id: 'user-123',
          iat: Math.floor(Date.now() / 1000) - 30,
        } as any;
        next();
      });
      app.post('/api/test', recentAuth(RecentAuthLimits.CRITICAL), (_req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).post('/api/test');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('rejects request when token is stale', async () => {
      // Mock stale token (issued 20 minutes ago, exceeds 15 minute limit)
      app = express();
      app.use((req, _res, next) => {
        req.user = {
          id: 'user-123',
          iat: Math.floor(Date.now() / 1000) - (20 * 60),
        } as any;
        next();
      });
      app.post('/api/test', recentAuth(RecentAuthLimits.DESTRUCTIVE), (_req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).post('/api/test');

      expect(response.status).toBe(401);
      expect(response.body.errorCode).toBe('UNAUTHORIZED');
      expect(response.body.message).toContain('recent authentication');
    });

    it('provides clear error message with age information', async () => {
      // Mock token issued 25 minutes ago
      app = express();
      app.use((req, _res, next) => {
        req.user = {
          id: 'user-123',
          iat: Math.floor(Date.now() / 1000) - (25 * 60),
        } as any;
        next();
      });
      app.post('/api/test', recentAuth(15 * 60), (_req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).post('/api/test');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('25m'); // Session age
      expect(response.body.message).toContain('15m'); // Max allowed
    });
  });

  describe('Authentication Requirements', () => {
    it('rejects request without authenticated user', async () => {
      app = express();
      app.post('/api/test', recentAuth(300), (_req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).post('/api/test');

      expect(response.status).toBe(401);
      expect(response.body.errorCode).toBe('UNAUTHORIZED');
      expect(response.body.message).toContain('Authentication required');
    });

    it('rejects request with invalid token payload', async () => {
      app = express();
      app.use((req, _res, next) => {
        req.user = { id: 'user-123' } as any; // Missing 'iat' field
        next();
      });
      app.post('/api/test', recentAuth(300), (_req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).post('/api/test');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid authentication token');
    });
  });

  describe('Different Sensitivity Levels', () => {
    beforeEach(() => {
      app = express();
    });

    it('enforces 5-minute limit for CRITICAL operations', async () => {
      app.use((req, _res, next) => {
        req.user = {
          id: 'user-123',
          iat: Math.floor(Date.now() / 1000) - (6 * 60), // 6 minutes ago
        } as any;
        next();
      });
      app.post('/api/upgrade', recentAuth(RecentAuthLimits.CRITICAL), (_req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).post('/api/upgrade');

      expect(response.status).toBe(401);
    });

    it('enforces 15-minute limit for DESTRUCTIVE operations', async () => {
      app.use((req, _res, next) => {
        req.user = {
          id: 'user-123',
          iat: Math.floor(Date.now() / 1000) - (10 * 60), // 10 minutes ago
        } as any;
        next();
      });
      app.post('/api/freeze', recentAuth(RecentAuthLimits.DESTRUCTIVE), (_req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).post('/api/freeze');

      expect(response.status).toBe(200); // Within 15-minute limit
    });

    it('enforces 30-minute limit for ADMIN operations', async () => {
      app.use((req, _res, next) => {
        req.user = {
          id: 'user-123',
          iat: Math.floor(Date.now() / 1000) - (25 * 60), // 25 minutes ago
        } as any;
        next();
      });
      app.post('/api/admin-action', recentAuth(RecentAuthLimits.ADMIN), (_req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).post('/api/admin-action');

      expect(response.status).toBe(200); // Within 30-minute limit
    });

    it('enforces 1-hour limit for STANDARD operations', async () => {
      app.use((req, _res, next) => {
        req.user = {
          id: 'user-123',
          iat: Math.floor(Date.now() / 1000) - (45 * 60), // 45 minutes ago
        } as any;
        next();
      });
      app.post('/api/standard', recentAuth(RecentAuthLimits.STANDARD), (_req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).post('/api/standard');

      expect(response.status).toBe(200); // Within 1-hour limit
    });
  });

  describe('Boundary Age Tests', () => {
    it('accepts request at exact age limit boundary', async () => {
      const maxAge = 300; // 5 minutes
      app = express();
      app.use((req, _res, next) => {
        req.user = {
          id: 'user-123',
          iat: Math.floor(Date.now() / 1000) - maxAge, // Exactly at limit
        } as any;
        next();
      });
      app.post('/api/test', recentAuth(maxAge), (_req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).post('/api/test');

      expect(response.status).toBe(200);
    });

    it('rejects request one second past age limit', async () => {
      const maxAge = 300; // 5 minutes
      app = express();
      app.use((req, _res, next) => {
        req.user = {
          id: 'user-123',
          iat: Math.floor(Date.now() / 1000) - maxAge - 1, // One second past limit
        } as any;
        next();
      });
      app.post('/api/test', recentAuth(maxAge), (_req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).post('/api/test');

      expect(response.status).toBe(401);
    });
  });

  describe('Integration with require2FA', () => {
    it('works in conjunction with 2FA middleware', async () => {
      app = express();
      
      // Simulate authenticateJWT
      app.use((req, _res, next) => {
        req.user = {
          id: 'user-123',
          iat: Math.floor(Date.now() / 1000) - 60,
        } as any;
        next();
      });
      
      // Simulate require2FA
      app.use((req, _res, next) => {
        const token = req.headers['x-2fa-token'];
        if (token !== 'valid-2fa-token') {
          return _res.status(401).json({ error: '2FA required' });
        }
        next();
      });
      
      // Recent auth check
      app.post('/api/admin/freeze', recentAuth(RecentAuthLimits.DESTRUCTIVE), (_req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/api/admin/freeze')
        .set('x-2fa-token', 'valid-2fa-token');

      expect(response.status).toBe(200);
    });
  });
});
