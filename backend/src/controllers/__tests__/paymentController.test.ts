import express from 'express';
import request from 'supertest';
import { PaymentController } from '../paymentController.js';
import { AnchorService } from '../../services/anchorService.js';
import { findConversionPaths } from '../../services/crossAssetPaymentService.js';
import { Sep31TrackingService } from '../../services/sep31TrackingService.js';

jest.mock('../../services/anchorService.js', () => ({
  AnchorService: {
    authenticate: jest.fn(),
    getSEP24Info: jest.fn(),
    getSEP31Info: jest.fn(),
    initiatePayment: jest.fn(),
    initiateSEP24Withdrawal: jest.fn(),
    getSEP24Transaction: jest.fn(),
  },
}));

jest.mock('../../services/sep31TrackingService.js', () => ({
  Sep31TrackingService: {
    recordInitiation: jest.fn(),
    updateFromPoll: jest.fn(),
  },
}));

const VALID_SENDER_KEY = 'G' + 'A'.repeat(55);

jest.mock('@stellar/stellar-sdk', () => ({
  Keypair: {
    fromSecret: jest.fn((secret: string) => ({
      publicKey: () => (secret === 'SVALID' ? VALID_SENDER_KEY : 'GBAD'),
    })),
  },
  StrKey: {
    isValidEd25519PublicKey: (key: string) => key.startsWith('G') && key.length === 56,
  },
}));

jest.mock('../../services/crossAssetPaymentService.js', () => ({
  findConversionPaths: jest.fn(),
}));

describe('PaymentController SEP-24 endpoints', () => {
  const app = express();
  app.use(express.json());
  app.post('/sep24/withdraw/interactive', PaymentController.initiateSEP24Withdrawal);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the interactive URL in JSON mode', async () => {
    (AnchorService.authenticate as jest.Mock).mockResolvedValueOnce('sep10-token');
    (AnchorService.initiateSEP24Withdrawal as jest.Mock).mockResolvedValueOnce({
      id: 'withdraw-1',
      url: 'https://anchor.example/interactive/withdraw-1',
    });

    const response = await request(app)
      .post('/sep24/withdraw/interactive')
      .send({
        domain: 'anchor.example',
        secretKey: 'SVALID',
        senderPublicKey: VALID_SENDER_KEY,
        transactionData: { asset_code: 'USD', lang: 'en' },
      });

    expect(response.status).toBe(200);
    expect(response.body.interactiveUrl).toBe('https://anchor.example/interactive/withdraw-1');
  });

  it('redirects to the interactive URL when redirect mode is requested', async () => {
    (AnchorService.authenticate as jest.Mock).mockResolvedValueOnce('sep10-token');
    (AnchorService.initiateSEP24Withdrawal as jest.Mock).mockResolvedValueOnce({
      id: 'withdraw-1',
      interactive_url: 'https://anchor.example/interactive/withdraw-1',
    });

    const response = await request(app)
      .post('/sep24/withdraw/interactive')
      .send({
        domain: 'anchor.example',
        secretKey: 'SVALID',
        senderPublicKey: VALID_SENDER_KEY,
        transactionData: { asset_code: 'USD' },
        redirect: true,
      });

    expect(response.status).toBe(303);
    expect(response.headers.location).toBe('https://anchor.example/interactive/withdraw-1');
  });
});

describe('PaymentController pathfinding', () => {
  const app = express();
  app.use(express.json());
  app.post('/pathfind', PaymentController.findPaths);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects malformed asset identifiers before pathfinding', async () => {
    const response = await request(app).post('/pathfind').send({
      fromAsset: 'not-a-stellar-asset',
      toAsset: 'native',
      amount: '10',
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid asset identifier');
    expect(findConversionPaths).not.toHaveBeenCalled();
  });
});

describe('PaymentController getAnchorInfo', () => {
  const app = express();
  app.use(express.json());
  app.get('/anchor-info', PaymentController.getAnchorInfo);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects malformed domain before any anchor lookup', async () => {
    const response = await request(app)
      .get('/anchor-info')
      .query({ domain: 'not-a-valid-domain!!' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(AnchorService.getSEP31Info).not.toHaveBeenCalled();
    expect(AnchorService.getSEP24Info).not.toHaveBeenCalled();
  });

  it('returns anchor info for a valid domain', async () => {
    (AnchorService.getSEP31Info as jest.Mock).mockResolvedValueOnce({ version: '1.0' });

    const response = await request(app)
      .get('/anchor-info')
      .query({ domain: 'anchor.example' })
      .expect(200);

    expect(response.body).toEqual({ version: '1.0' });
    expect(AnchorService.getSEP31Info).toHaveBeenCalledWith('anchor.example');
  });
});

describe('PaymentController initiateSEP31', () => {
  const app = express();
  app.use(express.json());
  app.post('/sep31/initiate', PaymentController.initiateSEP31);

  const validBody = {
    domain: 'anchor.example',
    secretKey: 'SVALID',
    senderPublicKey: VALID_SENDER_KEY,
    paymentData: {
      amount: '100.00',
      asset_code: 'USDC',
      receiver_id: 'receiver-123',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects missing paymentData fields before calling AnchorService', async () => {
    const response = await request(app)
      .post('/sep31/initiate')
      .send({
        ...validBody,
        paymentData: { amount: '100.00' },
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(AnchorService.authenticate).not.toHaveBeenCalled();
    expect(AnchorService.initiatePayment).not.toHaveBeenCalled();
  });

  it('rejects malformed amount in paymentData', async () => {
    const response = await request(app)
      .post('/sep31/initiate')
      .send({
        ...validBody,
        paymentData: {
          amount: '-50',
          asset_code: 'USDC',
          receiver_id: 'receiver-123',
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(AnchorService.authenticate).not.toHaveBeenCalled();
  });

  it('rejects invalid domain format', async () => {
    const response = await request(app)
      .post('/sep31/initiate')
      .send({
        ...validBody,
        domain: 'https://evil.example/path',
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(AnchorService.authenticate).not.toHaveBeenCalled();
  });

  it('initiates payment when payload is valid', async () => {
    (AnchorService.authenticate as jest.Mock).mockResolvedValueOnce('sep10-token');
    (AnchorService.initiatePayment as jest.Mock).mockResolvedValueOnce({
      id: 'tx-1',
      status: 'pending',
    });

    const response = await request(app).post('/sep31/initiate').send(validBody);

    expect(response.status).toBe(200);
    expect(AnchorService.authenticate).toHaveBeenCalled();
    expect(AnchorService.initiatePayment).toHaveBeenCalledWith(
      'anchor.example',
      'sep10-token',
      validBody.paymentData
    );
    expect(Sep31TrackingService.recordInitiation).toHaveBeenCalled();
  });
});
