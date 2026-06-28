import request from 'supertest';
import express from 'express';
import { Keypair } from '@stellar/stellar-sdk';
import bulkPaymentRoutes from '../../routes/bulkPaymentRoutes.js';

// ---------------------------------------------------------------------------
// Minimal Express app
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());
app.use('/bulk-payments', bulkPaymentRoutes);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const issuer = Keypair.random();
const recipient = Keypair.random();

const VALID_ISSUER_PUBLIC = issuer.publicKey();   // 56-char G...
const VALID_RECIPIENT = recipient.publicKey();     // 56-char G...
const VALID_ASSET_CODE = 'ORGUSD';

const validBody = {
  assetCode: VALID_ASSET_CODE,
  assetIssuer: VALID_ISSUER_PUBLIC,
  payments: [{ destination: VALID_RECIPIENT, amount: '100.00' }],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BulkPaymentController POST /bulk-payments/batch', () => {
  // ---- happy path ---------------------------------------------------------

  it('returns 202 for a valid request', async () => {
    const res = await request(app).post('/bulk-payments/batch').send(validBody);

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.assetCode).toBe(VALID_ASSET_CODE);
    expect(res.body.data.paymentCount).toBe(1);
  });

  // ---- assetCode validation -----------------------------------------------

  it('returns 400 for a malformed assetCode (lowercase letters)', async () => {
    const res = await request(app)
      .post('/bulk-payments/batch')
      .send({ ...validBody, assetCode: 'orgusd' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });

  it('returns 400 for a malformed assetCode (special characters)', async () => {
    const res = await request(app)
      .post('/bulk-payments/batch')
      .send({ ...validBody, assetCode: 'ORG-USD' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });

  it('returns 400 when assetCode exceeds 12 characters', async () => {
    const res = await request(app)
      .post('/bulk-payments/batch')
      .send({ ...validBody, assetCode: 'TOOLONGASSET1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });

  it('returns 400 when assetCode is an empty string', async () => {
    const res = await request(app)
      .post('/bulk-payments/batch')
      .send({ ...validBody, assetCode: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });

  it('returns 400 when assetCode is missing', async () => {
    const { assetCode: _omitted, ...bodyWithout } = validBody;

    const res = await request(app).post('/bulk-payments/batch').send(bodyWithout);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });

  // ---- other field validation ----------------------------------------------

  it('returns 400 when assetIssuer is not 56 characters', async () => {
    const res = await request(app)
      .post('/bulk-payments/batch')
      .send({ ...validBody, assetIssuer: 'SHORTKEY' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });

  it('returns 400 when payments array is empty', async () => {
    const res = await request(app)
      .post('/bulk-payments/batch')
      .send({ ...validBody, payments: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });

  it('returns 400 when the body is missing entirely', async () => {
    const res = await request(app).post('/bulk-payments/batch').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });
});
