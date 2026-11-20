import express from 'express';
import request from 'supertest';
import { computeWeakETag, ifNoneMatchMatches, sendJsonWithETag } from '../etag.js';

describe('computeWeakETag (#1810)', () => {
  it('is deterministic for identical bodies', () => {
    expect(computeWeakETag('{"a":1}')).toBe(computeWeakETag('{"a":1}'));
  });

  it('changes when the body changes', () => {
    expect(computeWeakETag('{"a":1}')).not.toBe(computeWeakETag('{"a":2}'));
  });

  it('produces a weak tag', () => {
    expect(computeWeakETag('x')).toMatch(/^W\/"[0-9a-f]{32}"$/);
  });
});

describe('ifNoneMatchMatches (#1810)', () => {
  const etag = 'W/"abc123"';

  it('returns false when the header is absent', () => {
    expect(ifNoneMatchMatches(undefined, etag)).toBe(false);
    expect(ifNoneMatchMatches('', etag)).toBe(false);
  });

  it('matches the exact tag', () => {
    expect(ifNoneMatchMatches('W/"abc123"', etag)).toBe(true);
  });

  it('compares weakly, ignoring the W/ prefix', () => {
    expect(ifNoneMatchMatches('"abc123"', etag)).toBe(true);
  });

  it('matches any tag in a comma-separated list', () => {
    expect(ifNoneMatchMatches('W/"other", W/"abc123" , W/"more"', etag)).toBe(true);
  });

  it('does not match a different tag', () => {
    expect(ifNoneMatchMatches('W/"zzz"', etag)).toBe(false);
  });

  it('matches the wildcard', () => {
    expect(ifNoneMatchMatches('*', etag)).toBe(true);
  });
});

describe('sendJsonWithETag (#1810)', () => {
  const app = express();
  app.get('/data', (req, res) => sendJsonWithETag(req, res, { value: 42 }));

  it('returns 200 with JSON and an ETag, then 304 for a matching If-None-Match', async () => {
    const first = await request(app).get('/data');
    expect(first.status).toBe(200);
    expect(first.headers['content-type']).toMatch(/application\/json/);
    expect(first.body).toEqual({ value: 42 });

    const second = await request(app).get('/data').set('If-None-Match', first.headers.etag);
    expect(second.status).toBe(304);
    expect(second.text ?? '').toBe('');
  });
});
