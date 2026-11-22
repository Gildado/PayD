/**
 * Tests for Body Size Limit Middleware
 */

import request from 'supertest';
import express, { Express } from 'express';
import {
  bodySizeLimit,
  bodySizeLimitErrorHandler,
  BodySizeLimits,
} from '../bodySizeLimitMiddleware.js';

describe('Body Size Limit Middleware', () => {
  let app: Express;

  describe('Standard Size Limit', () => {
    beforeEach(() => {
      app = express();
      
      app.post('/api/standard', ...bodySizeLimit(BodySizeLimits.STANDARD), (_req, res) => {
        res.json({ message: 'ok' });
      });
      
      app.use(bodySizeLimitErrorHandler);
    });

    it('accepts body within limit', async () => {
      const payload = { data: 'x'.repeat(50 * 1024) }; // 50KB
      
      const response = await request(app)
        .post('/api/standard')
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('ok');
    });

    it('rejects body exceeding limit with 413', async () => {
      const payload = { data: 'x'.repeat(200 * 1024) }; // 200KB (exceeds 100KB limit)
      
      const response = await request(app)
        .post('/api/standard')
        .send(payload);

      expect(response.status).toBe(413);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Bulk Operations Size Limit', () => {
    beforeEach(() => {
      app = express();
      
      app.post('/api/bulk', ...bodySizeLimit(BodySizeLimits.BULK), (_req, res) => {
        res.json({ message: 'ok' });
      });
      
      app.use(bodySizeLimitErrorHandler);
    });

    it('accepts larger body for bulk operations', async () => {
      const payload = { data: 'x'.repeat(800 * 1024) }; // 800KB
      
      const response = await request(app)
        .post('/api/bulk')
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('ok');
    });

    it('rejects body exceeding bulk limit with 413', async () => {
      const payload = { data: 'x'.repeat(2 * 1024 * 1024) }; // 2MB (exceeds 1MB limit)
      
      const response = await request(app)
        .post('/api/bulk')
        .send(payload);

      expect(response.status).toBe(413);
    });
  });

  describe('JSON Depth Limit', () => {
    beforeEach(() => {
      app = express();
      
      app.post('/api/depth-check', ...bodySizeLimit(1024 * 1024), (_req, res) => {
        res.json({ message: 'ok' });
      });
      
      app.use(bodySizeLimitErrorHandler);
    });

    it('accepts shallow JSON objects', async () => {
      const payload = {
        level1: {
          level2: {
            level3: {
              data: 'valid'
            }
          }
        }
      };
      
      const response = await request(app)
        .post('/api/depth-check')
        .send(payload);

      expect(response.status).toBe(200);
    });

    it('rejects deeply nested JSON with 413', async () => {
      // Create an object with 15 levels of nesting (exceeds MAX_JSON_DEPTH of 10)
      let deepPayload: any = { data: 'deep' };
      for (let i = 0; i < 15; i++) {
        deepPayload = { nested: deepPayload };
      }
      
      const response = await request(app)
        .post('/api/depth-check')
        .send(deepPayload);

      expect(response.status).toBe(413);
      expect(response.body.error).toContain('depth');
    });

    it('accepts nested arrays within depth limit', async () => {
      const payload = {
        items: [
          { nested: { data: 'value1' } },
          { nested: { data: 'value2' } },
        ]
      };
      
      const response = await request(app)
        .post('/api/depth-check')
        .send(payload);

      expect(response.status).toBe(200);
    });
  });

  describe('Depth Check Disabled', () => {
    beforeEach(() => {
      app = express();
      
      app.post(
        '/api/no-depth-check',
        ...bodySizeLimit(1024 * 1024, { checkDepth: false }),
        (_req, res) => {
          res.json({ message: 'ok' });
        }
      );
      
      app.use(bodySizeLimitErrorHandler);
    });

    it('skips depth check when disabled', async () => {
      // Create a deeply nested object
      let deepPayload: any = { data: 'deep' };
      for (let i = 0; i < 15; i++) {
        deepPayload = { nested: deepPayload };
      }
      
      const response = await request(app)
        .post('/api/no-depth-check')
        .send(deepPayload);

      // Should succeed because depth check is disabled
      expect(response.status).toBe(200);
    });
  });

  describe('Custom Content Types', () => {
    beforeEach(() => {
      app = express();
      
      app.post(
        '/api/custom',
        ...bodySizeLimit(BodySizeLimits.STANDARD, { type: 'application/vnd.api+json' }),
        (_req, res) => {
          res.json({ message: 'ok' });
        }
      );
      
      app.use(bodySizeLimitErrorHandler);
    });

    it('parses custom content types', async () => {
      const response = await request(app)
        .post('/api/custom')
        .set('Content-Type', 'application/vnd.api+json')
        .send({ data: 'test' });

      expect(response.status).toBe(200);
    });
  });

  describe('Error Handler', () => {
    beforeEach(() => {
      app = express();
      app.post('/api/test', ...bodySizeLimit(1024), (_req, res) => {
        res.json({ message: 'ok' });
      });
      app.use(bodySizeLimitErrorHandler);
    });

    it('provides clear error message for oversized body', async () => {
      const payload = { data: 'x'.repeat(10 * 1024) }; // 10KB (exceeds 1KB limit)
      
      const response = await request(app)
        .post('/api/test')
        .send(payload);

      expect(response.status).toBe(413);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('exceeds maximum');
    });
  });
});
