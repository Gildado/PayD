import { Keypair } from '@stellar/stellar-sdk';
import { MultiSigController } from '../multiSigController.js';
import { MultiSigService } from '../../services/multiSigService.js';

jest.mock('../../services/multiSigService.js', () => ({
  MultiSigService: {
    configureIssuerMultiSig: jest.fn(),
  },
}));

describe('MultiSigController.configure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects malformed signer public keys with 400 before Stellar configuration', async () => {
    const req = {
      body: {
        issuerSecret: Keypair.random().secret(),
        signers: [{ publicKey: 'not-a-stellar-public-key', weight: 1 }],
        thresholds: {
          low: 1,
          med: 1,
          high: 1,
          masterWeight: 1,
        },
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await MultiSigController.configure(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('valid Stellar public key'),
      })
    );
    expect(MultiSigService.configureIssuerMultiSig).not.toHaveBeenCalled();
  });
});
