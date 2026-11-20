import { describe, it, expect } from '@jest/globals';
import {
  getCorrelationId,
  getCorrelationStore,
  withCorrelationId,
  generateCorrelationId,
  CORRELATION_ID_HEADER,
} from '../correlationContext.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('correlationContext', () => {
  describe('CORRELATION_ID_HEADER', () => {
    it('is the expected header name', () => {
      expect(CORRELATION_ID_HEADER).toBe('x-correlation-id');
    });
  });

  describe('generateCorrelationId', () => {
    it('returns a valid UUID v4', () => {
      expect(generateCorrelationId()).toMatch(UUID_RE);
    });

    it('returns a unique ID on each call', () => {
      expect(generateCorrelationId()).not.toBe(generateCorrelationId());
    });
  });

  describe('getCorrelationId outside context', () => {
    it('returns undefined when no context is active', () => {
      expect(getCorrelationId()).toBeUndefined();
    });
  });

  describe('withCorrelationId', () => {
    it('makes correlationId available inside the callback', () => {
      const id = generateCorrelationId();
      withCorrelationId(id, () => {
        expect(getCorrelationId()).toBe(id);
      });
    });

    it('makes the full store available inside the callback', () => {
      const id = generateCorrelationId();
      const reqId = generateCorrelationId();
      withCorrelationId(id, () => {
        const store = getCorrelationStore();
        expect(store?.correlationId).toBe(id);
        expect(store?.requestId).toBe(reqId);
      }, reqId);
    });

    it('stores requestId when provided', () => {
      const id = generateCorrelationId();
      const reqId = 'req-123';
      withCorrelationId(id, () => {
        expect(getCorrelationStore()?.requestId).toBe(reqId);
      }, reqId);
    });

    it('does not store requestId when omitted', () => {
      const id = generateCorrelationId();
      withCorrelationId(id, () => {
        expect(getCorrelationStore()?.requestId).toBeUndefined();
      });
    });

    it('context does not leak outside the callback', () => {
      const id = generateCorrelationId();
      withCorrelationId(id, () => {});
      expect(getCorrelationId()).toBeUndefined();
    });

    it('supports nested contexts — inner wins', () => {
      const outer = generateCorrelationId();
      const inner = generateCorrelationId();
      withCorrelationId(outer, () => {
        withCorrelationId(inner, () => {
          expect(getCorrelationId()).toBe(inner);
        });
        expect(getCorrelationId()).toBe(outer);
      });
    });

    it('propagates through async operations', async () => {
      const id = generateCorrelationId();
      await withCorrelationId(id, async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        expect(getCorrelationId()).toBe(id);
      });
    });

    it('returns the callback return value', () => {
      const result = withCorrelationId('some-id', () => 42);
      expect(result).toBe(42);
    });
  });
});
