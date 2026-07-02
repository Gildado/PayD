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

const mockAuth = (req: any, _res: any, next: any) => {
  if (req.headers.authorization === 'Bearer no-org') {
    req.user = {};
    return next();
  }
  if (req.headers.authorization === 'Bearer org2') {
    req.user = { organizationId: 2 };
    return next();
  }
  // Default is organization 1
  req.user = { organizationId: 1 };
  next();
};

const app = express();
app.use(express.json());
app.get('/api/trustlines/check/:walletAddress', TrustlineController.checkWallet);
app.post('/api/trustlines/employees/:employeeId/refresh', mockAuth, TrustlineController.refreshEmployee);


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

describe('TrustlineController - refreshEmployee', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully refresh trustline status for a valid employee in the same organization', async () => {
    const mockRecord = {
      id: 1,
      employee_id: 10,
      wallet_address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      asset_code: 'ORGUSD',
      asset_issuer: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      status: 'established',
      last_checked_at: '2026-07-02T10:00:00Z',
    };

    (TrustlineService.refreshEmployeeTrustline as jest.Mock).mockResolvedValue(mockRecord);

    const response = await request(app)
      .post('/api/trustlines/employees/10/refresh')
      .send({ assetCode: 'ORGUSD' })
      .expect(200);

    expect(response.body).toEqual(mockRecord);
    expect(TrustlineService.refreshEmployeeTrustline).toHaveBeenCalledWith(
      10,
      1,
      'ORGUSD',
      'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
    );
  });

  it('should return 403 if the user is not associated with an organization', async () => {
    const response = await request(app)
      .post('/api/trustlines/employees/10/refresh')
      .set('Authorization', 'Bearer no-org')
      .send({ assetCode: 'ORGUSD' })
      .expect(403);

    expect(response.body).toEqual({
      error: 'User is not associated with an organization.',
    });
    expect(TrustlineService.refreshEmployeeTrustline).not.toHaveBeenCalled();
  });

  it('should return 404 if the employee belongs to a different organization', async () => {
    (TrustlineService.refreshEmployeeTrustline as jest.Mock).mockImplementation(
      async (employeeId, organizationId, assetCode, assetIssuer) => {
        if (organizationId === 2) {
          return null;
        }
        return { id: 1 };
      }
    );

    const response = await request(app)
      .post('/api/trustlines/employees/10/refresh')
      .set('Authorization', 'Bearer org2')
      .send({ assetCode: 'ORGUSD' })
      .expect(404);

    expect(response.body).toEqual({
      error: 'Employee not found or has no wallet address.',
    });
  });

  it('should return 404 if the employee does not exist', async () => {
    (TrustlineService.refreshEmployeeTrustline as jest.Mock).mockResolvedValue(null);

    const response = await request(app)
      .post('/api/trustlines/employees/999/refresh')
      .send({ assetCode: 'ORGUSD' })
      .expect(404);

    expect(response.body).toEqual({
      error: 'Employee not found or has no wallet address.',
    });
  });
});
