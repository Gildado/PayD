import { MultiSigService, SignerInfo, MultiSigThresholds } from '../multiSigService';
import { StellarService } from '../stellarService';
import { Keypair, Transaction, Networks } from '@stellar/stellar-sdk';

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
            const signers: SignerInfo[] = [
                { publicKey: issuerKeypair.publicKey(), weight: 1 },
            ];
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
    });

    describe('configureIssuerMultiSig', () => {
        it('should reject invalid configuration', async () => {
            const signers: SignerInfo[] = [
                { publicKey: issuerKeypair.publicKey(), weight: 1 },
            ];
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
});
