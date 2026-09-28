import request from 'supertest';
import express from 'express';
import { Keypair } from '@stellar/stellar-sdk';
import { FreezeResult, FreezePage } from '../../services/freezeService.js';

// ---------------------------------------------------------------------------
// Mock FreezeService with an explicit factory so the real module (and its
// database/env imports) is never executed during the controller tests.
// ---------------------------------------------------------------------------
jest.mock('../../services/freezeService', () => ({
  FreezeService: {
    toggleAccountFreeze: jest.fn(),
    toggleGlobalFreeze: jest.fn(),
    isFrozen: jest.fn(),
    getLatestLog: jest.fn(),
    listLogs: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock the assets config to return a specific issuer for testing
// ---------------------------------------------------------------------------
jest.mock('../../config/assets', () => ({
  getAssetIssuer: jest.fn((assetCode: string) => {
    // Return a known issuer public key for ORGUSD
    if (assetCode === 'ORGUSD') {
      return 'GAWULNWUYJZW37TMU3ZEDNM2HHZK2YJ7YBX3I32QIV4EMC7WZCRNANNO';
    }
    return null;
  }),
}));

// ---------------------------------------------------------------------------
// Mock rate-limit middleware to a pass-through so tests are not throttled
// ---------------------------------------------------------------------------
jest.mock('../../middlewares/rateLimitMiddleware', () => ({
  rateLimitMiddleware: () => (_req: any, _res: any, next: any) => next(),
}));

// ---------------------------------------------------------------------------
// Mock authentication and authorization middleware
// ---------------------------------------------------------------------------
jest.mock('../../middlewares/auth.js', () => ({
  __esModule: true,
  default: (req: any, _res: any, next: any) => {
    req.user = { id: 1, organizationId: 1, role: 'EMPLOYER' };
    next();
  },
}));

jest.mock('../../middlewares/rbac.js', () => ({
  authorizeRoles: () => (_req: any, _res: any, next: any) => next(),
  isolateOrganization: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../middlewares/ipWhitelist.js', () => ({
  optionalIpWhitelist: (_req: any, _res: any, next: any) => next(),
}));

import freezeRoutes from '../../routes/freezeRoutes.js';
import { FreezeService } from '../../services/freezeService.js';

// ---------------------------------------------------------------------------
// Build a minimal Express app that mirrors how the real server mounts the
// freeze routes (without unrelated middleware).
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());
app.use('/freeze', freezeRoutes);

// ---------------------------------------------------------------------------
// Shared test fixtures — use real Stellar keypairs so Zod length checks pass
// and Keypair.fromSecret() inside the controller works correctly.
// ---------------------------------------------------------------------------
// Create a keypair that matches the mocked issuer public key
const MOCKED_ISSUER_PUBLIC = 'GAWULNWUYJZW37TMU3ZEDNM2HHZK2YJ7YBX3I32QIV4EMC7WZCRNANNO';
const MOCKED_ISSUER_SECRET = 'SBOECKNTFJDABS6D2ON5DEQRP7MHSH7YZRNWTAE6WUB3BDV3EJ7UHMON';
const testIssuer = Keypair.fromSecret(MOCKED_ISSUER_SECRET);

const testTarget = Keypair.random();
const wrongIssuer = Keypair.random(); // For testing mismatched secrets

const VALID_ISSUER_SECRET = testIssuer.secret(); // 56-char S...
const VALID_ISSUER_PUBLIC = testIssuer.publicKey(); // Should match MOCKED_ISSUER_PUBLIC
const WRONG_ISSUER_SECRET = wrongIssuer.secret(); // Different issuer for mismatch tests
const VALID_TARGET = testTarget.publicKey(); // 56-char G...
const VALID_ASSET_CODE = 'ORGUSD';

const mockAccountResult: FreezeResult = {
  txHash: 'deadbeefdeadbeef1234',
  action: 'freeze',
  scope: 'account',
  targetAccount: VALID_TARGET,
  assetCode: VALID_ASSET_CODE,
  assetIssuer: VALID_ISSUER_PUBLIC,
};

const mockPage: FreezePage = {
  data: [{ id: 1, action: 'freeze', scope: 'account' } as any],
  total: 1,
  page: 1,
  limit: 20,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FreezeController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // POST /freeze/account/freeze
  // -------------------------------------------------------------------------

  describe('POST /freeze/account/freeze', () => {
    it('returns 200 and the freeze result for a valid request body', async () => {
      (FreezeService.toggleAccountFreeze as jest.Mock).mockResolvedValue(mockAccountResult);

      const res = await request(app).post('/freeze/account/freeze').send({
        issuerSecret: VALID_ISSUER_SECRET,
        targetAccount: VALID_TARGET,
        assetCode: VALID_ASSET_CODE,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        txHash: 'deadbeefdeadbeef1234',
        action: 'freeze',
        scope: 'account',
      });

      // Controller must pass 'freeze' (not 'unfreeze') as the action arg
      expect(FreezeService.toggleAccountFreeze).toHaveBeenCalledWith(
        expect.objectContaining({ publicKey: expect.any(Function) }), // Keypair
        VALID_TARGET,
        VALID_ASSET_CODE,
        'freeze',
        undefined // reason omitted
      );
    });

    it('forwards the optional reason field to the service', async () => {
      (FreezeService.toggleAccountFreeze as jest.Mock).mockResolvedValue(mockAccountResult);

      await request(app).post('/freeze/account/freeze').send({
        issuerSecret: VALID_ISSUER_SECRET,
        targetAccount: VALID_TARGET,
        assetCode: VALID_ASSET_CODE,
        reason: 'Fraud investigation',
      });

      expect(FreezeService.toggleAccountFreeze).toHaveBeenCalledWith(
        expect.anything(),
        VALID_TARGET,
        VALID_ASSET_CODE,
        'freeze',
        'Fraud investigation'
      );
    });

    it('returns 400 when targetAccount is not exactly 56 characters', async () => {
      const res = await request(app).post('/freeze/account/freeze').send({
        issuerSecret: VALID_ISSUER_SECRET,
        targetAccount: 'too-short',
        assetCode: VALID_ASSET_CODE,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(FreezeService.toggleAccountFreeze).not.toHaveBeenCalled();
    });

    it('returns 400 when assetCode contains lowercase letters', async () => {
      const res = await request(app).post('/freeze/account/freeze').send({
        issuerSecret: VALID_ISSUER_SECRET,
        targetAccount: VALID_TARGET,
        assetCode: 'orgusd',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('returns 400 when assetCode exceeds 12 characters', async () => {
      const res = await request(app).post('/freeze/account/freeze').send({
        issuerSecret: VALID_ISSUER_SECRET,
        targetAccount: VALID_TARGET,
        assetCode: 'TOOLONGASSET123',
      });

      expect(res.status).toBe(400);
    });

    it('returns 400 when issuerSecret is shorter than 56 characters', async () => {
      const res = await request(app).post('/freeze/account/freeze').send({
        issuerSecret: 'short',
        targetAccount: VALID_TARGET,
        assetCode: VALID_ASSET_CODE,
      });

      expect(res.status).toBe(400);
    });

    it('returns 400 when the body is missing entirely', async () => {
      const res = await request(app).post('/freeze/account/freeze').send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('returns 400 when issuerSecret does not match the configured asset issuer', async () => {
      const res = await request(app).post('/freeze/account/freeze').send({
        issuerSecret: WRONG_ISSUER_SECRET,
        targetAccount: VALID_TARGET,
        assetCode: VALID_ASSET_CODE,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Issuer secret mismatch');
      expect(res.body.error).toContain('configured issuer');
      
      // Service should not be called if validation fails
      expect(FreezeService.toggleAccountFreeze).not.toHaveBeenCalled();
    });

    it('returns 502 when Horizon rejects the transaction', async () => {
      (FreezeService.toggleAccountFreeze as jest.Mock).mockRejectedValue({
        response: {
          data: {
            title: 'Transaction Failed',
            extras: { result_codes: { transaction: 'tx_bad_auth' } },
          },
        },
      });

      const res = await request(app).post('/freeze/account/freeze').send({
        issuerSecret: VALID_ISSUER_SECRET,
        targetAccount: VALID_TARGET,
        assetCode: VALID_ASSET_CODE,
      });

      expect(res.status).toBe(502);
      expect(res.body.error).toBe('Stellar network error');
      expect(res.body.resultCodes).toEqual({ transaction: 'tx_bad_auth' });
    });

    it('returns 500 for unexpected internal errors', async () => {
      (FreezeService.toggleAccountFreeze as jest.Mock).mockRejectedValue(
        new Error('DB connection lost')
      );

      const res = await request(app).post('/freeze/account/freeze').send({
        issuerSecret: VALID_ISSUER_SECRET,
        targetAccount: VALID_TARGET,
        assetCode: VALID_ASSET_CODE,
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal Server Error');
    });
  });

  // -------------------------------------------------------------------------
  // POST /freeze/account/unfreeze
  // -------------------------------------------------------------------------

  describe('POST /freeze/account/unfreeze', () => {
    it('returns 200 and passes "unfreeze" action to the service', async () => {
      (FreezeService.toggleAccountFreeze as jest.Mock).mockResolvedValue({
        ...mockAccountResult,
        action: 'unfreeze',
      });

      const res = await request(app).post('/freeze/account/unfreeze').send({
        issuerSecret: VALID_ISSUER_SECRET,
        targetAccount: VALID_TARGET,
        assetCode: VALID_ASSET_CODE,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.action).toBe('unfreeze');
      expect(FreezeService.toggleAccountFreeze).toHaveBeenCalledWith(
        expect.anything(),
        VALID_TARGET,
        VALID_ASSET_CODE,
        'unfreeze',
        undefined
      );
    });

    it('returns 400 when issuerSecret does not match the configured asset issuer', async () => {
      const res = await request(app).post('/freeze/account/unfreeze').send({
        issuerSecret: WRONG_ISSUER_SECRET,
        targetAccount: VALID_TARGET,
        assetCode: VALID_ASSET_CODE,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Issuer secret mismatch');
      expect(FreezeService.toggleAccountFreeze).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // POST /freeze/global/freeze
  // -------------------------------------------------------------------------

  describe('POST /freeze/global/freeze', () => {
    it('returns 200 with the affected account count', async () => {
      const secondTarget = Keypair.random().publicKey();
      (FreezeService.toggleGlobalFreeze as jest.Mock).mockResolvedValue([
        mockAccountResult,
        { ...mockAccountResult, targetAccount: secondTarget },
      ]);

      const res = await request(app).post('/freeze/global/freeze').send({
        issuerSecret: VALID_ISSUER_SECRET,
        assetCode: VALID_ASSET_CODE,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.affectedCount).toBe(2);
      expect(res.body.data.results).toHaveLength(2);
    });

    it('returns 200 with affectedCount=0 when no holders exist', async () => {
      (FreezeService.toggleGlobalFreeze as jest.Mock).mockResolvedValue([]);

      const res = await request(app).post('/freeze/global/freeze').send({
        issuerSecret: VALID_ISSUER_SECRET,
        assetCode: VALID_ASSET_CODE,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.affectedCount).toBe(0);
    });

    it('returns 400 when assetCode is missing', async () => {
      const res = await request(app)
        .post('/freeze/global/freeze')
        .send({ issuerSecret: VALID_ISSUER_SECRET });

      expect(res.status).toBe(400);
      expect(FreezeService.toggleGlobalFreeze).not.toHaveBeenCalled();
    });

    it('does not require targetAccount in the body', async () => {
      (FreezeService.toggleGlobalFreeze as jest.Mock).mockResolvedValue([]);

      const res = await request(app).post('/freeze/global/freeze').send({
        issuerSecret: VALID_ISSUER_SECRET,
        assetCode: VALID_ASSET_CODE,
        // no targetAccount
      });

      expect(res.status).toBe(200);
    });

    it('returns 400 when issuerSecret does not match the configured asset issuer', async () => {
      const res = await request(app).post('/freeze/global/freeze').send({
        issuerSecret: WRONG_ISSUER_SECRET,
        assetCode: VALID_ASSET_CODE,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Issuer secret mismatch');
      expect(FreezeService.toggleGlobalFreeze).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // POST /freeze/global/unfreeze
  // -------------------------------------------------------------------------

  describe('POST /freeze/global/unfreeze', () => {
    it('returns 200 for a valid global unfreeze request', async () => {
      (FreezeService.toggleGlobalFreeze as jest.Mock).mockResolvedValue([mockAccountResult]);

      const res = await request(app).post('/freeze/global/unfreeze').send({
        issuerSecret: VALID_ISSUER_SECRET,
        assetCode: VALID_ASSET_CODE,
      });

      expect(res.status).toBe(200);
      expect(FreezeService.toggleGlobalFreeze).toHaveBeenCalledWith(
        expect.anything(),
        VALID_ASSET_CODE,
        'unfreeze',
        undefined
      );
    });

    it('returns 400 when issuerSecret does not match the configured asset issuer', async () => {
      const res = await request(app).post('/freeze/global/unfreeze').send({
        issuerSecret: WRONG_ISSUER_SECRET,
        assetCode: VALID_ASSET_CODE,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Issuer secret mismatch');
      expect(FreezeService.toggleGlobalFreeze).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // GET /freeze/status/:targetAccount
  // -------------------------------------------------------------------------

  describe('GET /freeze/status/:targetAccount', () => {
    it('returns 200 with isFrozen=true when the account is frozen', async () => {
      (FreezeService.isFrozen as jest.Mock).mockResolvedValue(true);
      (FreezeService.getLatestLog as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .get(`/freeze/status/${VALID_TARGET}`)
        .query({ assetCode: VALID_ASSET_CODE, assetIssuer: VALID_ISSUER_PUBLIC });

      expect(res.status).toBe(200);
      expect(res.body.isFrozen).toBe(true);
      expect(res.body.targetAccount).toBe(VALID_TARGET);
      expect(res.body.assetCode).toBe(VALID_ASSET_CODE);
      expect(res.body.latestAction).toBeNull();
    });

    it('returns 200 with isFrozen=false and the latest log entry', async () => {
      const mockLog = { id: 7, action: 'unfreeze', created_at: '2024-06-01T00:00:00Z' };
      (FreezeService.isFrozen as jest.Mock).mockResolvedValue(false);
      (FreezeService.getLatestLog as jest.Mock).mockResolvedValue(mockLog);

      const res = await request(app)
        .get(`/freeze/status/${VALID_TARGET}`)
        .query({ assetCode: VALID_ASSET_CODE, assetIssuer: VALID_ISSUER_PUBLIC });

      expect(res.status).toBe(200);
      expect(res.body.isFrozen).toBe(false);
      expect(res.body.latestAction).toEqual(mockLog);
    });

    // New validation added in this PR: targetAccount path param must be 56 chars
    it('returns 400 when the :targetAccount path param is not 56 characters', async () => {
      const res = await request(app)
        .get('/freeze/status/bad-key')
        .query({ assetCode: VALID_ASSET_CODE, assetIssuer: VALID_ISSUER_PUBLIC });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(FreezeService.isFrozen).not.toHaveBeenCalled();
    });

    it('returns 400 when assetIssuer query param is missing', async () => {
      const res = await request(app)
        .get(`/freeze/status/${VALID_TARGET}`)
        .query({ assetCode: VALID_ASSET_CODE }); // no assetIssuer

      expect(res.status).toBe(400);
      expect(FreezeService.isFrozen).not.toHaveBeenCalled();
    });

    it('returns 400 when assetCode query param is missing', async () => {
      const res = await request(app)
        .get(`/freeze/status/${VALID_TARGET}`)
        .query({ assetIssuer: VALID_ISSUER_PUBLIC }); // no assetCode

      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // GET /freeze/logs
  // -------------------------------------------------------------------------

  describe('GET /freeze/logs', () => {
    it('returns 200 with paginated log entries', async () => {
      (FreezeService.listLogs as jest.Mock).mockResolvedValue(mockPage);

      const res = await request(app).get('/freeze/logs').query({ page: 1, limit: 20 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.total).toBe(1);
      expect(res.body.data).toHaveLength(1);
    });

    it('passes filter query params through to FreezeService.listLogs', async () => {
      (FreezeService.listLogs as jest.Mock).mockResolvedValue({ ...mockPage, data: [] });

      await request(app).get('/freeze/logs').query({
        action: 'freeze',
        assetCode: VALID_ASSET_CODE,
        targetAccount: VALID_TARGET,
        page: 2,
        limit: 10,
      });

      expect(FreezeService.listLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'freeze',
          assetCode: VALID_ASSET_CODE,
          targetAccount: VALID_TARGET,
          page: 2,
          limit: 10,
        })
      );
    });

    it('returns 400 when page is not a valid integer', async () => {
      const res = await request(app).get('/freeze/logs').query({ page: 'not-a-number' });

      expect(res.status).toBe(400);
      expect(FreezeService.listLogs).not.toHaveBeenCalled();
    });

    it('returns 400 when action is an invalid enum value', async () => {
      const res = await request(app).get('/freeze/logs').query({ action: 'delete' }); // not "freeze" or "unfreeze"

      expect(res.status).toBe(400);
    });
  });
});
