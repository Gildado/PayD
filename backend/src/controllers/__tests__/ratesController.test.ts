import request from 'supertest';
import express from 'express';
import { RatesController } from '../ratesController.js';
import { convertOrgUsdAmount, getOrgUsdRates } from '../../services/fxRateService.js';

jest.mock('../../services/fxRateService.js', () => ({
  convertOrgUsdAmount: jest.fn(),
  getOrgUsdRates: jest.fn(),
}));

describe('RatesController GET /rates', () => {
  const app = express();
  app.get('/rates', RatesController.getRates);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with rates payload', async () => {
    (getOrgUsdRates as jest.Mock).mockResolvedValueOnce({
      base: 'ORGUSD',
      quoteBase: 'USD',
      fetchedAt: '2026-03-24T00:00:00.000Z',
      provider: 'open.er-api.com',
      rates: { USD: 1, NGN: 1500, EUR: 0.9, ORGUSD: 1 },
      cacheTtlSeconds: 300,
    });

    const response = await request(app).get('/rates');

    expect(response.status).toBe(200);
    expect(response.body.base).toBe('ORGUSD');
    expect(response.body.rates.USD).toBe(1);
    expect(response.headers['cache-control']).toBe('public, max-age=60');
  });

  it('returns 502 when provider/service fails', async () => {
    (getOrgUsdRates as jest.Mock).mockRejectedValueOnce(new Error('provider down'));

    const response = await request(app).get('/rates');

    expect(response.status).toBe(502);
    expect(response.body.error).toBe('Bad Gateway');
    expect(response.body.message).toContain('Unable to load exchange rates');
  });
});

describe('RatesController GET /rates/convert', () => {
  const app = express();
  app.get('/rates/convert', RatesController.convert);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects out-of-bounds amounts', async () => {
    const response = await request(app).get('/rates/convert?amount=1e30&from=ORGUSD&to=KES');

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('no greater than');
    expect(convertOrgUsdAmount).not.toHaveBeenCalled();
  });
});
