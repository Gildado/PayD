import request from 'supertest';
import express from 'express';
import { RatesController } from '../ratesController.js';
import { convertOrgUsdAmount, getOrgUsdRates } from '../../services/fxRateService.js';

jest.mock('../../services/fxRateService.js', () => ({
  convertOrgUsdAmount: jest.fn(),
  getOrgUsdRates: jest.fn(),
}));

const RATES_PAYLOAD = {
  base: 'ORGUSD',
  quoteBase: 'USD',
  fetchedAt: '2026-03-24T00:00:00.000Z',
  provider: 'open.er-api.com',
  rates: { USD: 1, NGN: 1500, EUR: 0.9, ORGUSD: 1 },
  cacheTtlSeconds: 300,
};

const buildApp = () => {
  const app = express();
  app.get('/rates', RatesController.getRates);
  app.get('/rates/convert', RatesController.convert);
  return app;
};

describe('RatesController conditional GET (ETag / If-None-Match, #1810)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /rates', () => {
    it('returns 200 with a weak ETag and the JSON body on first request', async () => {
      (getOrgUsdRates as jest.Mock).mockResolvedValue(RATES_PAYLOAD);

      const response = await request(buildApp()).get('/rates');

      expect(response.status).toBe(200);
      expect(response.headers.etag).toMatch(/^W\/"[0-9a-f]{32}"$/);
      expect(response.body).toEqual(RATES_PAYLOAD);
      expect(response.headers['cache-control']).toBe('public, max-age=60');
    });

    it('returns 304 with no body when If-None-Match matches unchanged data', async () => {
      (getOrgUsdRates as jest.Mock).mockResolvedValue(RATES_PAYLOAD);
      const app = buildApp();

      const first = await request(app).get('/rates');
      const etag = first.headers.etag;

      const second = await request(app).get('/rates').set('If-None-Match', etag);

      expect(second.status).toBe(304);
      expect(second.text ?? '').toBe('');
      expect(second.headers.etag).toBe(etag);
      expect(second.headers['cache-control']).toBe('public, max-age=60');
    });

    it('returns 200 with a new ETag when the rates have changed', async () => {
      const app = buildApp();
      (getOrgUsdRates as jest.Mock).mockResolvedValueOnce(RATES_PAYLOAD);
      const first = await request(app).get('/rates');

      (getOrgUsdRates as jest.Mock).mockResolvedValueOnce({
        ...RATES_PAYLOAD,
        rates: { ...RATES_PAYLOAD.rates, NGN: 1600 },
      });
      const second = await request(app).get('/rates').set('If-None-Match', first.headers.etag);

      expect(second.status).toBe(200);
      expect(second.body.rates.NGN).toBe(1600);
      expect(second.headers.etag).not.toBe(first.headers.etag);
    });

    it('returns 200 when If-None-Match carries a stale tag', async () => {
      (getOrgUsdRates as jest.Mock).mockResolvedValue(RATES_PAYLOAD);

      const response = await request(buildApp())
        .get('/rates')
        .set('If-None-Match', 'W/"00000000000000000000000000000000"');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(RATES_PAYLOAD);
    });

    it('matches a strong-form client tag against the weak server tag', async () => {
      (getOrgUsdRates as jest.Mock).mockResolvedValue(RATES_PAYLOAD);
      const app = buildApp();
      const first = await request(app).get('/rates');
      const opaque = first.headers.etag.replace(/^W\//, '');

      const response = await request(app).get('/rates').set('If-None-Match', opaque);

      expect(response.status).toBe(304);
    });
  });

  describe('GET /rates/convert', () => {
    const CONVERSION = { amount: 100, from: 'ORGUSD', to: 'NGN', converted: 150000, rate: 1500 };

    it('returns 304 when If-None-Match matches the conversion result', async () => {
      (convertOrgUsdAmount as jest.Mock).mockResolvedValue(CONVERSION);
      const app = buildApp();

      const first = await request(app).get('/rates/convert?amount=100&to=NGN');
      expect(first.status).toBe(200);
      expect(first.headers.etag).toBeDefined();

      const second = await request(app)
        .get('/rates/convert?amount=100&to=NGN')
        .set('If-None-Match', first.headers.etag);

      expect(second.status).toBe(304);
      expect(second.text ?? '').toBe('');
    });

    it('returns 200 with the body when no If-None-Match header is sent', async () => {
      (convertOrgUsdAmount as jest.Mock).mockResolvedValue(CONVERSION);

      const response = await request(buildApp()).get('/rates/convert?amount=100&to=NGN');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(CONVERSION);
    });
  });
});
