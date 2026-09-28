import request from 'supertest';
import jwt from 'jsonwebtoken';
import express from 'express';
import { config } from '../config/env.js';
import { assetPathPaymentService } from '../services/assetPathPaymentService.js';
import assetPathPaymentRoutes from '../routes/assetPathPaymentRoutes.js';

const createToken = () =>
  jwt.sign(
    {
      id: '1',
      email: 'employee@payd.test',
      role: 'EMPLOYER',
      organizationId: 1,
    },
    config.JWT_SECRET,
    { expiresIn: '1h' }
  );

describe('Asset Path Payment Routes', () => {
  const app = express();
  const bearer = `Bearer ${createToken()}`;

  beforeAll(() => {
    app.use(express.json());
    app.use('/api/v1/path-payments', assetPathPaymentRoutes);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects unauthenticated access to supported assets', async () => {
    const res = await request(app).get('/api/v1/path-payments/supported-assets');

    expect(res.status).toBe(401);
  });

  it('returns supported assets for authenticated requests', async () => {
    jest.spyOn(assetPathPaymentService, 'getSupportedAssets').mockResolvedValue([
      { code: 'XLM', isNative: true },
      {
        code: 'USDC',
        issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3KLQEH2Y6DFOUHD7I2DMSK7P',
        isNative: false,
      },
    ]);

    const res = await request(app)
      .get('/api/v1/path-payments/supported-assets')
      .set('Authorization', bearer);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(2);
    expect(res.body.data[0].code).toBe('XLM');
  });

  it('returns validation errors for malformed find-paths payloads', async () => {
    const res = await request(app)
      .post('/api/v1/path-payments/find-paths')
      .set('Authorization', bearer)
      .send({ amount: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Validation failed');
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it('returns 404 when no valid routes are found', async () => {
    jest.spyOn(assetPathPaymentService, 'findOptimalPath').mockResolvedValue([]);

    const res = await request(app)
      .post('/api/v1/path-payments/find-paths')
      .set('Authorization', bearer)
      .send({
        sourceAsset: { code: 'XLM', isNative: true },
        destinationAsset: { code: 'EURT', isNative: false },
        amount: '100',
        amountType: 'source',
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when execute is missing both source and destination amounts', async () => {
    const res = await request(app)
      .post('/api/v1/path-payments/execute')
      .set('Authorization', bearer)
      .send({
        sourceAccount: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        destinationAccount: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBRY',
        sourceAsset: { code: 'XLM', isNative: true },
        destinationAsset: {
          code: 'USDC',
          issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3KLQEH2Y6DFOUHD7I2DMSK7P',
          isNative: false,
        },
        maximumSourceAmount: '100',
        minimumDestinationAmount: '90',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Either sourceAmount or destinationAmount/);
  });
});
