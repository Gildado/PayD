import request from 'supertest';
import express from 'express';
import { TrustlineController } from '../trustlineController.js';
import { TrustlineService } from '../../services/trustlineService.js';

// Mock dependencies
jest.mock('../../config/env', () => ({
  config: {
    DATABASE_URL: 'postgres://mock',
    ORGUSD_ISSUER_PUBLIC: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  },
}));

jest.mock('../../config/database.js', () => ({
  __esModule: true,
  pool: {
    query: jest.fn(),
  },
}));

jest.mock('../../services/trustlineService.js');
jest.mock('../../config/assets.js', () => ({
  getAssetIssuer: jest.fn((assetCode: string) => {
    if (assetCode === 'ORGUSD' || assetCode === 'USDC') {
      return 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    }
    return null;
  }),
  getSupportedAssets: jest.fn(() => []),
}));

const app = express();
app.use(express.json());
app.get('/api/trustlines/check/:walletAddress', TrustlineController.checkWallet);

describe('TrustlineController - checkWallet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return trustline status for a valid wallet address', async () => {
    const validWallet = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
    const mockResult = { exists: true, balance: '100.0000000' };

    (TrustlineService.checkTrustline as jest.Mock).mockResolvedValue(mockResult);

    const response = await request(app)
      .get(`/api/trustlines/check/${validWallet}`)
      .expect(200);

    expect(response.body).toEqual({
      walletAddress: validWallet,
      assetCode: 'ORGUSD',
      assetIssuer: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      trustlineEstablished: true,
      balance: '100.0000000',
    });

    expect(TrustlineService.checkTrustline).toHaveBeenCalledWith(
      validWallet,
      'ORGUSD',
      'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
    );
  });

  it('should return 400 for a malformed wallet address', async () => {
    const invalidWallet = 'INVALID_ADDRESS_123';

    const response = await request(app)
      .get(`/api/trustlines/check/${invalidWallet}`)
      .expect(400);

    expect(response.body).toEqual({
      error: 'Invalid Stellar wallet address format.',
    });

    // Verify that the Horizon service was never called
    expect(TrustlineService.checkTrustline).not.toHaveBeenCalled();
  });

  it('should return 400 for an empty wallet address', async () => {
    const response = await request(app)
      .get('/api/trustlines/check/')
      .expect(404); // Express returns 404 for missing route param

    // Verify that the Horizon service was never called
    expect(TrustlineService.checkTrustline).not.toHaveBeenCalled();
  });

  it('should return 400 for a wallet address that is too short', async () => {
    const shortWallet = 'GAAA';

    const response = await request(app)
      .get(`/api/trustlines/check/${shortWallet}`)
      .expect(400);

    expect(response.body).toEqual({
      error: 'Invalid Stellar wallet address format.',
    });

    expect(TrustlineService.checkTrustline).not.toHaveBeenCalled();
  });

  it('should return 400 for a wallet address with invalid characters', async () => {
    const invalidCharsWallet = 'G@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@';

    const response = await request(app)
      .get(`/api/trustlines/check/${invalidCharsWallet}`)
      .expect(400);

    expect(response.body).toEqual({
      error: 'Invalid Stellar wallet address format.',
    });

    expect(TrustlineService.checkTrustline).not.toHaveBeenCalled();
  });

  it('should handle query parameters for assetCode', async () => {
    const validWallet = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
    const mockResult = { exists: false };

    (TrustlineService.checkTrustline as jest.Mock).mockResolvedValue(mockResult);

    const response = await request(app)
      .get(`/api/trustlines/check/${validWallet}`)
      .query({ assetCode: 'USDC' })
      .expect(200);

    expect(response.body.assetCode).toBe('USDC');
    expect(response.body.trustlineEstablished).toBe(false);
  });

  it('should return 500 when TrustlineService throws an error', async () => {
    const validWallet = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

    (TrustlineService.checkTrustline as jest.Mock).mockRejectedValue(
      new Error('Horizon service error')
    );

    const response = await request(app)
      .get(`/api/trustlines/check/${validWallet}`)
      .expect(500);

    expect(response.body).toEqual({
      error: 'Failed to check trustline status.',
    });
  });
});
