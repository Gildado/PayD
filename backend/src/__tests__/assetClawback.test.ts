import { AssetService } from '../services/assetService';
import { StellarService } from '../services/stellarService';
import { pool } from '../config/database';
import { Keypair, Asset } from '@stellar/stellar-sdk';

/**
 * Integration tests for Clawback Support for ORGUSD
 *
 * Acceptance Criteria:
 * 1. ORGUSD asset issued with auth_clawback_enabled flag
 * 2. Service module implements clawback operation
 * 3. Audit trail captures all clawback events
 * 4. Integration tests verify asset recovery from target wallets
 */
describe('Clawback Support for ORGUSD', () => {
  describe('AssetService.issueOrgUsdAsset', () => {
    it('returns an Asset with the correct code and issuer', async () => {
      const issuerKeypair = Keypair.random();
      const distributorKeypair = Keypair.random();

      const mockServer = {
        loadAccount: jest.fn().mockResolvedValue({
          accountId: () => issuerKeypair.publicKey(),
          sequenceNumber: () => '100',
          incrementSequenceNumber: jest.fn(),
        }),
        submitTransaction: jest.fn().mockResolvedValue({ hash: 'mock-issue-hash' }),
      };

      jest.spyOn(StellarService, 'getServer').mockReturnValue(mockServer as any);
      jest
        .spyOn(StellarService, 'getNetworkPassphrase')
        .mockReturnValue('Test SDF Network ; September 2015');

      const asset = await AssetService.issueOrgUsdAsset(issuerKeypair, distributorKeypair, '1000');

      expect(asset).toBeInstanceOf(Asset);
      expect(asset.code).toBe('ORGUSD');
      expect(asset.issuer).toBe(issuerKeypair.publicKey());
    });

    it('throws when the Stellar transaction fails', async () => {
      const issuerKeypair = Keypair.random();
      const distributorKeypair = Keypair.random();

      const mockServer = {
        loadAccount: jest.fn().mockResolvedValue({
          accountId: () => issuerKeypair.publicKey(),
          sequenceNumber: () => '100',
          incrementSequenceNumber: jest.fn(),
        }),
        submitTransaction: jest.fn().mockRejectedValue(new Error('tx_bad_seq')),
      };

      jest.spyOn(StellarService, 'getServer').mockReturnValue(mockServer as any);
      jest
        .spyOn(StellarService, 'getNetworkPassphrase')
        .mockReturnValue('Test SDF Network ; September 2015');

      await expect(
        AssetService.issueOrgUsdAsset(issuerKeypair, distributorKeypair, '1000')
      ).rejects.toThrow('tx_bad_seq');
    });
  });

  describe('AssetService.clawbackAsset', () => {
    const issuerKeypair = Keypair.random();
    const targetAccount = Keypair.random().publicKey();

    beforeEach(() => {
      jest
        .spyOn(StellarService, 'getNetworkPassphrase')
        .mockReturnValue('Test SDF Network ; September 2015');
    });

    it('returns a transaction hash on success and writes audit log', async () => {
      const mockTxHash = 'abcdef1234567890';

      const mockServer = {
        loadAccount: jest.fn().mockResolvedValue({
          accountId: () => issuerKeypair.publicKey(),
          sequenceNumber: () => '200',
          incrementSequenceNumber: jest.fn(),
        }),
        submitTransaction: jest.fn().mockResolvedValue({ hash: mockTxHash }),
      };

      jest.spyOn(StellarService, 'getServer').mockReturnValue(mockServer as any);
      jest.spyOn(StellarService, 'simulateTransaction').mockResolvedValue({
        success: true,
        errorMessage: null,
      } as any);

      const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
      jest.spyOn(pool, 'query').mockImplementation(mockQuery);

      const hash = await AssetService.clawbackAsset(
        issuerKeypair,
        targetAccount,
        '100',
        'compliance'
      );

      expect(hash).toBe(mockTxHash);

      // Verify audit trail was written
      const auditCall = mockQuery.mock.calls.find(
        (args: any[]) => typeof args[0] === 'string' && args[0].includes('clawback_audit_logs')
      );
      expect(auditCall).toBeDefined();
      const params = auditCall![1] as string[];
      expect(params).toContain(mockTxHash);
      expect(params).toContain('ORGUSD');
      expect(params).toContain('100');
      expect(params).toContain(targetAccount);
      expect(params).toContain(issuerKeypair.publicKey());
      expect(params).toContain('compliance');
    });

    it('throws when simulation fails and does not submit the transaction', async () => {
      const mockServer = {
        loadAccount: jest.fn().mockResolvedValue({
          accountId: () => issuerKeypair.publicKey(),
          sequenceNumber: () => '200',
          incrementSequenceNumber: jest.fn(),
        }),
        submitTransaction: jest.fn(),
      };

      jest.spyOn(StellarService, 'getServer').mockReturnValue(mockServer as any);
      jest.spyOn(StellarService, 'simulateTransaction').mockResolvedValue({
        success: false,
        errorMessage: 'op_no_clawback',
      } as any);

      await expect(AssetService.clawbackAsset(issuerKeypair, targetAccount, '50')).rejects.toThrow(
        'Transaction simulation failed'
      );

      expect(mockServer.submitTransaction).not.toHaveBeenCalled();
    });

    it('writes audit log with null reason when reason is omitted', async () => {
      const mockTxHash = 'nullreason123';

      const mockServer = {
        loadAccount: jest.fn().mockResolvedValue({
          accountId: () => issuerKeypair.publicKey(),
          sequenceNumber: () => '300',
          incrementSequenceNumber: jest.fn(),
        }),
        submitTransaction: jest.fn().mockResolvedValue({ hash: mockTxHash }),
      };

      jest.spyOn(StellarService, 'getServer').mockReturnValue(mockServer as any);
      jest.spyOn(StellarService, 'simulateTransaction').mockResolvedValue({
        success: true,
        errorMessage: null,
      } as any);

      const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
      jest.spyOn(pool, 'query').mockImplementation(mockQuery);

      await AssetService.clawbackAsset(issuerKeypair, targetAccount, '25');

      const auditCall = mockQuery.mock.calls.find(
        (args: any[]) => typeof args[0] === 'string' && args[0].includes('clawback_audit_logs')
      );
      expect(auditCall).toBeDefined();
      const params = auditCall![1] as any[];
      expect(params[5]).toBeNull();
    });
  });

  describe('AssetService.clawbackClaimableBalance', () => {
    const issuerKeypair = Keypair.random();

    beforeEach(() => {
      jest
        .spyOn(StellarService, 'getNetworkPassphrase')
        .mockReturnValue('Test SDF Network ; September 2015');
    });

    it('returns a transaction hash when clawback of claimable balance succeeds', async () => {
      const mockTxHash = 'cb-clawback-hash';
      const balanceId = '00000000929b20b72e5890ab51c24f1cc46fa01c4f318d8d33367d24dd614cfdf5491072';

      const mockServer = {
        loadAccount: jest.fn().mockResolvedValue({
          accountId: () => issuerKeypair.publicKey(),
          sequenceNumber: () => '400',
          incrementSequenceNumber: jest.fn(),
        }),
        submitTransaction: jest.fn().mockResolvedValue({ hash: mockTxHash }),
      };

      jest.spyOn(StellarService, 'getServer').mockReturnValue(mockServer as any);
      jest.spyOn(StellarService, 'simulateTransaction').mockResolvedValue({
        success: true,
        errorMessage: null,
      } as any);

      const hash = await AssetService.clawbackClaimableBalance(issuerKeypair, balanceId);
      expect(hash).toBe(mockTxHash);
    });

    it('throws when simulation fails for claimable balance clawback', async () => {
      const balanceId = '00000000929b20b72e5890ab51c24f1cc46fa01c4f318d8d33367d24dd614cfdf5491072';

      const mockServer = {
        loadAccount: jest.fn().mockResolvedValue({
          accountId: () => issuerKeypair.publicKey(),
          sequenceNumber: () => '400',
          incrementSequenceNumber: jest.fn(),
        }),
        submitTransaction: jest.fn(),
      };

      jest.spyOn(StellarService, 'getServer').mockReturnValue(mockServer as any);
      jest.spyOn(StellarService, 'simulateTransaction').mockResolvedValue({
        success: false,
        errorMessage: 'balance_not_found',
      } as any);

      await expect(AssetService.clawbackClaimableBalance(issuerKeypair, balanceId)).rejects.toThrow(
        'Transaction simulation failed'
      );
    });
  });
});
