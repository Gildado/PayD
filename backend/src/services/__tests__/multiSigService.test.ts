import { MultiSigService, SignerInfo, MultiSigThresholds } from '../multiSigService.js';
import { StellarService } from '../stellarService.js';
import {
  Keypair,
  Transaction,
  Networks,
  Account,
  TransactionBuilder,
  Operation,
  Asset,
  Memo,
} from '@stellar/stellar-sdk';

// Mock the StellarService
jest.mock('../stellarService');

describe('MultiSigService', () => {
  let issuerKeypair: Keypair;
  let signer1Keypair: Keypair;
  let signer2Keypair: Keypair;

  beforeEach(() => {
    jest.clearAllMocks();
    issuerKeypair = Keypair.random();
    signer1Keypair = Keypair.random();
    signer2Keypair = Keypair.random();
  });

  describe('validateMultiSigConfig', () => {
    it('should validate a correct 2-of-3 configuration', () => {
      const signers: SignerInfo[] = [
        { publicKey: issuerKeypair.publicKey(), weight: 1 },
        { publicKey: signer1Keypair.publicKey(), weight: 1 },
        { publicKey: signer2Keypair.publicKey(), weight: 1 },
      ];
      const thresholds: MultiSigThresholds = {
        low: 1,
        med: 2,
        high: 3,
        masterWeight: 1,
      };

      const result = MultiSigService.validateMultiSigConfig(signers, thresholds);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject a config with fewer than 2 signers', () => {
      const signers: SignerInfo[] = [{ publicKey: issuerKeypair.publicKey(), weight: 1 }];
      const thresholds: MultiSigThresholds = {
        low: 1,
        med: 1,
        high: 1,
        masterWeight: 1,
      };

      const result = MultiSigService.validateMultiSigConfig(signers, thresholds);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least 2 signers are required for multi-sig.');
    });

    it('should reject a config where total weight < high threshold (lockout risk)', () => {
      const signers: SignerInfo[] = [
        { publicKey: issuerKeypair.publicKey(), weight: 1 },
        { publicKey: signer1Keypair.publicKey(), weight: 1 },
      ];
      const thresholds: MultiSigThresholds = {
        low: 1,
        med: 2,
        high: 5, // Total weight is 2, but high threshold is 5
        masterWeight: 1,
      };

      const result = MultiSigService.validateMultiSigConfig(signers, thresholds);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('lock the account permanently');
    });

    it('should reject a config where a single signer meets high threshold', () => {
      const signers: SignerInfo[] = [
        { publicKey: issuerKeypair.publicKey(), weight: 10 },
        { publicKey: signer1Keypair.publicKey(), weight: 1 },
      ];
      const thresholds: MultiSigThresholds = {
        low: 1,
        med: 2,
        high: 5, // Single signer has weight 10, which meets high threshold
        masterWeight: 10,
      };

      const result = MultiSigService.validateMultiSigConfig(signers, thresholds);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('defeats the purpose of multi-sig');
    });

    it('should reject out-of-order thresholds', () => {
      const signers: SignerInfo[] = [
        { publicKey: issuerKeypair.publicKey(), weight: 1 },
        { publicKey: signer1Keypair.publicKey(), weight: 1 },
      ];
      const thresholds: MultiSigThresholds = {
        low: 3,
        med: 2, // med < low
        high: 2,
        masterWeight: 1,
      };

      const result = MultiSigService.validateMultiSigConfig(signers, thresholds);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Medium threshold must be >= low threshold.');
    });

    it('should reject a config where master weight meets/exceeds medium threshold', () => {
      const signers: SignerInfo[] = [
        { publicKey: signer1Keypair.publicKey(), weight: 1 },
        { publicKey: signer2Keypair.publicKey(), weight: 1 },
      ];

      const thresholds: MultiSigThresholds = {
        low: 1,
        med: 2,
        high: 2,
        masterWeight: 2, // master alone meets med
      };

      const result = MultiSigService.validateMultiSigConfig(signers, thresholds);
      expect(result.valid).toBe(false);
      expect(result.errors.join(' ')).toContain('Master weight');
      expect(result.errors.join(' ')).toContain('medium threshold');
    });

    it('should reject a config where a single non-master signer meets medium threshold by itself', () => {
      const signers: SignerInfo[] = [
        { publicKey: signer1Keypair.publicKey(), weight: 2 }, // single signer meets med
        { publicKey: signer2Keypair.publicKey(), weight: 1 },
      ];

      const thresholds: MultiSigThresholds = {
        low: 1,
        med: 2,
        high: 3,
        masterWeight: 0,
      };

      const result = MultiSigService.validateMultiSigConfig(signers, thresholds);
      expect(result.valid).toBe(false);
      expect(result.errors.join(' ')).toContain('meets or exceeds the medium threshold');
    });
  });

  describe('configureIssuerMultiSig', () => {
    it('should reject invalid configuration', async () => {
      const signers: SignerInfo[] = [{ publicKey: issuerKeypair.publicKey(), weight: 1 }];
      const thresholds: MultiSigThresholds = {
        low: 1,
        med: 1,
        high: 1,
        masterWeight: 1,
      };

      await expect(
        MultiSigService.configureIssuerMultiSig(issuerKeypair, signers, thresholds)
      ).rejects.toThrow('Invalid multi-sig config');
    });

    it('should call StellarService to set up multi-sig with valid config', async () => {
      const mockTx = { sign: jest.fn() } as unknown as Transaction;
      (StellarService.setupMultiSig as jest.Mock).mockResolvedValue(mockTx);
      (StellarService.signTransaction as jest.Mock).mockReturnValue(mockTx);
      (StellarService.submitTransaction as jest.Mock).mockResolvedValue({
        hash: 'abc123',
        ledger: 100,
        success: true,
      });

      const signers: SignerInfo[] = [
        { publicKey: issuerKeypair.publicKey(), weight: 1 },
        { publicKey: signer1Keypair.publicKey(), weight: 1 },
        { publicKey: signer2Keypair.publicKey(), weight: 1 },
      ];
      const thresholds: MultiSigThresholds = {
        low: 1,
        med: 2,
        high: 3,
        masterWeight: 1,
      };

      const result = await MultiSigService.configureIssuerMultiSig(
        issuerKeypair,
        signers,
        thresholds
      );

      expect(StellarService.setupMultiSig).toHaveBeenCalled();

      const setupArgs = (StellarService.setupMultiSig as jest.Mock).mock.calls[0];
      expect(setupArgs[0]).toBe(issuerKeypair);
      const passedConfig = setupArgs[1] as any;
      expect(passedConfig.lowThreshold).toBe(thresholds.low);
      expect(passedConfig.medThreshold).toBe(thresholds.med);
      expect(passedConfig.highThreshold).toBe(thresholds.high);
      expect(passedConfig.masterWeight).toBe(thresholds.masterWeight);

      expect(StellarService.signTransaction).toHaveBeenCalledWith(mockTx, issuerKeypair);
      expect(StellarService.submitTransaction).toHaveBeenCalledWith(mockTx);
      expect(result.success).toBe(true);
    });
  });

  describe('addIssuerSigner', () => {
    it('should reject invalid weight', async () => {
      await expect(
        MultiSigService.addIssuerSigner(issuerKeypair, signer1Keypair.publicKey(), 0)
      ).rejects.toThrow('Signer weight must be between 1 and 255');
    });

    it('should add a signer with valid weight', async () => {
      const mockTx = { sign: jest.fn() } as unknown as Transaction;
      (StellarService.addSigner as jest.Mock).mockResolvedValue(mockTx);
      (StellarService.signTransaction as jest.Mock).mockReturnValue(mockTx);
      (StellarService.submitTransaction as jest.Mock).mockResolvedValue({
        hash: 'def456',
        ledger: 101,
        success: true,
      });

      const result = await MultiSigService.addIssuerSigner(
        issuerKeypair,
        signer1Keypair.publicKey(),
        5
      );

      expect(StellarService.addSigner).toHaveBeenCalledWith(
        issuerKeypair,
        signer1Keypair.publicKey(),
        5
      );
      expect(result.success).toBe(true);
    });
  });

  describe('removeIssuerSigner', () => {
    it('should remove a signer by setting weight to 0', async () => {
      const mockTx = { sign: jest.fn() } as unknown as Transaction;
      (StellarService.removeSigner as jest.Mock).mockResolvedValue(mockTx);
      (StellarService.signTransaction as jest.Mock).mockReturnValue(mockTx);
      (StellarService.submitTransaction as jest.Mock).mockResolvedValue({
        hash: 'ghi789',
        ledger: 102,
        success: true,
      });

      const result = await MultiSigService.removeIssuerSigner(
        issuerKeypair,
        signer1Keypair.publicKey()
      );

      expect(StellarService.removeSigner).toHaveBeenCalledWith(
        issuerKeypair,
        signer1Keypair.publicKey()
      );
      expect(result.success).toBe(true);
    });
  });

  describe('getMultiSigStatus', () => {
    it('should return multi-sig status for an account', async () => {
      (StellarService.getAccountSigners as jest.Mock).mockResolvedValue([
        { key: issuerKeypair.publicKey(), weight: 1 },
        { key: signer1Keypair.publicKey(), weight: 1 },
      ]);
      (StellarService.getAccountThresholds as jest.Mock).mockResolvedValue({
        lowThreshold: 1,
        medThreshold: 2,
        highThreshold: 2,
        masterWeight: 1,
      });

      const status = await MultiSigService.getMultiSigStatus(issuerKeypair.publicKey());

      expect(status.isMultiSig).toBe(true);
      expect(status.signers).toHaveLength(2);
      expect(status.thresholds.med).toBe(2);
    });

    it('should report non-multi-sig for single-signer accounts', async () => {
      (StellarService.getAccountSigners as jest.Mock).mockResolvedValue([
        { key: issuerKeypair.publicKey(), weight: 1 },
      ]);
      (StellarService.getAccountThresholds as jest.Mock).mockResolvedValue({
        lowThreshold: 0,
        medThreshold: 0,
        highThreshold: 0,
        masterWeight: 1,
      });

      const status = await MultiSigService.getMultiSigStatus(issuerKeypair.publicKey());

      expect(status.isMultiSig).toBe(false);
      expect(status.signers).toHaveLength(1);
    });
  });

  describe('canMeetThreshold (signature weight model)', () => {
    function buildSignedTx({
      networkPassphrase,
      sourcePublicKey,
      sequence,
      destinationPublicKey,
      amount,
      signers,
    }: {
      networkPassphrase: string;
      sourcePublicKey: string;
      sequence: string;
      destinationPublicKey: string;
      amount: string;
      signers: Keypair[];
    }): Transaction {
      const tx = new TransactionBuilder(new Account(sourcePublicKey, sequence), {
        fee: '100',
        networkPassphrase,
      })
        .addOperation(
          Operation.payment({
            destination: destinationPublicKey,
            asset: Asset.native(),
            amount,
          })
        )
        .addMemo(Memo.text('test'))
        .setTimeout(30)
        .build();

      signers.forEach((s) => tx.sign(s));
      return tx;
    }

    beforeEach(() => {
      // Replace the mocked verifySignature with real logic so we can
      // validate the authorization weight model end-to-end.
      (StellarService.verifySignature as jest.Mock).mockImplementation(
        (transaction: Transaction, publicKey: string) => {
          const rawSig = transaction.signatures.find((sig) => {
            const keypair = Keypair.fromPublicKey(publicKey);
            return sig.hint().toString('base64') === keypair.signatureHint().toString('base64');
          });
          return !!rawSig;
        }
      );
    });

    it('should block authorization when only master key signs (masterWeight=0)', () => {
      const master = issuerKeypair;
      const signerA = signer1Keypair;
      const signerB = signer2Keypair;

      const thresholds: MultiSigThresholds = {
        low: 1,
        med: 2,
        high: 3,
        masterWeight: 0,
      };

      const signers: SignerInfo[] = [
        { publicKey: signerA.publicKey(), weight: 1 },
        { publicKey: signerB.publicKey(), weight: 1 },
      ];

      const txMasterOnly = buildSignedTx({
        networkPassphrase: Networks.TESTNET,
        sourcePublicKey: master.publicKey(),
        sequence: '1',
        destinationPublicKey: Keypair.random().publicKey(),
        amount: '1',
        signers: [master],
      });

      expect(
        MultiSigService.computeSignedWeight(txMasterOnly, master.publicKey(), signers, thresholds)
      ).toBe(0);
      expect(
        MultiSigService.canMeetThreshold(
          txMasterOnly,
          master.publicKey(),
          signers,
          thresholds,
          'med'
        )
      ).toBe(false);
    });

    it('should allow authorization when enough signer keys sign (2-of-2 for medium)', () => {
      const master = issuerKeypair;
      const signerA = signer1Keypair;
      const signerB = signer2Keypair;

      const thresholds: MultiSigThresholds = {
        low: 1,
        med: 2,
        high: 3,
        masterWeight: 0,
      };

      const signers: SignerInfo[] = [
        { publicKey: signerA.publicKey(), weight: 1 },
        { publicKey: signerB.publicKey(), weight: 1 },
      ];

      const txTwoSigners = buildSignedTx({
        networkPassphrase: Networks.TESTNET,
        sourcePublicKey: master.publicKey(),
        sequence: '1',
        destinationPublicKey: Keypair.random().publicKey(),
        amount: '1',
        signers: [signerA, signerB],
      });

      expect(
        MultiSigService.computeSignedWeight(txTwoSigners, master.publicKey(), signers, thresholds)
      ).toBe(2);
      expect(
        MultiSigService.canMeetThreshold(
          txTwoSigners,
          master.publicKey(),
          signers,
          thresholds,
          'med'
        )
      ).toBe(true);
    });

    it('should block authorization when only one signer key signs (medium threshold not met)', () => {
      const master = issuerKeypair;
      const signerA = signer1Keypair;
      const signerB = signer2Keypair;

      const thresholds: MultiSigThresholds = {
        low: 1,
        med: 2,
        high: 3,
        masterWeight: 0,
      };

      const signers: SignerInfo[] = [
        { publicKey: signerA.publicKey(), weight: 1 },
        { publicKey: signerB.publicKey(), weight: 1 },
      ];

      const txOneSigner = buildSignedTx({
        networkPassphrase: Networks.TESTNET,
        sourcePublicKey: master.publicKey(),
        sequence: '1',
        destinationPublicKey: Keypair.random().publicKey(),
        amount: '1',
        signers: [signerA],
      });

      expect(
        MultiSigService.computeSignedWeight(txOneSigner, master.publicKey(), signers, thresholds)
      ).toBe(1);
      expect(
        MultiSigService.canMeetThreshold(
          txOneSigner,
          master.publicKey(),
          signers,
          thresholds,
          'med'
        )
      ).toBe(false);
    });
  });
});
