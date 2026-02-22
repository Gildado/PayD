import {
    StellarService,
    TransactionResult,
    MultiSigConfig,
} from '../stellarService';
import {
    Keypair,
    Asset,
    Operation,
    Memo,
    Networks,
    Transaction,
} from '@stellar/stellar-sdk';

jest.mock('@stellar/stellar-sdk', () => {
    const actual = jest.requireActual('@stellar/stellar-sdk');
    return {
        ...actual,
        Horizon: {
            Server: jest.fn().mockImplementation(() => ({
                loadAccount: jest.fn(),
                submitTransaction: jest.fn(),
                accounts: jest.fn(() => ({
                    call: jest.fn(),
                })),
            })),
        },
    };
});

describe('StellarService', () => {
    let mockServer: any;
    let testKeypair: Keypair;
    let testDestinationKeypair: Keypair;

    beforeEach(() => {
        jest.clearAllMocks();
        StellarService.resetServer();

        testKeypair = Keypair.random();
        testDestinationKeypair = Keypair.random();

        mockServer = StellarService.getServer();
    });

    describe('Server and Network Configuration', () => {
        it('should return a Horizon server instance with default testnet URL', () => {
            const server = StellarService.getServer();
            expect(server).toBeDefined();
        });

        it('should return testnet network passphrase by default', () => {
            const passphrase = StellarService.getNetworkPassphrase();
            expect(passphrase).toBe(Networks.TESTNET);
        });

        it('should cache the server instance', () => {
            const server1 = StellarService.getServer();
            const server2 = StellarService.getServer();
            expect(server1).toBe(server2);
        });

        it('should cache the network passphrase', () => {
            const passphrase1 = StellarService.getNetworkPassphrase();
            const passphrase2 = StellarService.getNetworkPassphrase();
            expect(passphrase1).toBe(passphrase2);
        });

        it('should reset server and network when resetServer is called', () => {
            StellarService.getServer();
            StellarService.getNetworkPassphrase();
            StellarService.resetServer();
            
            const server = StellarService.getServer();
            expect(server).toBeDefined();
        });
    });

    describe('Transaction Construction', () => {
        const mockAccountResponse = {
            accountId: () => testKeypair.publicKey(),
            sequenceNumber: () => '3000000000000000',
        };

        beforeEach(() => {
            mockServer.loadAccount.mockResolvedValue(mockAccountResponse);
        });

        it('should build a simple payment transaction', async () => {
            const transaction = await StellarService.createPaymentTransaction(
                testKeypair,
                testDestinationKeypair.publicKey(),
                '100',
                Asset.native()
            );

            expect(transaction).toBeDefined();
            expect(transaction.operations).toHaveLength(1);
            expect(transaction.operations[0].type).toBe('payment');
        });

        it('should build a payment transaction with custom fee', async () => {
            const transaction = await StellarService.createPaymentTransaction(
                testKeypair,
                testDestinationKeypair.publicKey(),
                '100',
                Asset.native(),
                { fee: '200' }
            );

            expect(transaction.fee).toBe('200');
        });

        it('should build a payment transaction with memo', async () => {
            const memo = Memo.text('Test payment');
            const transaction = await StellarService.createPaymentTransaction(
                testKeypair,
                testDestinationKeypair.publicKey(),
                '100',
                Asset.native(),
                { memo }
            );

            expect(transaction.memo).toEqual(memo);
        });

        it('should build a payment transaction with custom timeout', async () => {
            const transaction = await StellarService.createPaymentTransaction(
                testKeypair,
                testDestinationKeypair.publicKey(),
                '100',
                Asset.native(),
                { timeout: 300 }
            );

            expect(transaction).toBeDefined();
        });

        it('should build a payment transaction for custom asset', async () => {
            const issuerKeypair = Keypair.random();
            const customAsset = new Asset('USDC', issuerKeypair.publicKey());
            
            const transaction = await StellarService.createPaymentTransaction(
                testKeypair,
                testDestinationKeypair.publicKey(),
                '50',
                customAsset
            );

            expect(transaction).toBeDefined();
            const paymentOp = transaction.operations[0] as any;
            expect(paymentOp.asset.code).toBe('USDC');
            expect(paymentOp.asset.issuer).toBe(issuerKeypair.publicKey());
        });

        it('should build transaction with multiple operations', async () => {
            const operations = [
                Operation.payment({
                    destination: testDestinationKeypair.publicKey(),
                    asset: Asset.native(),
                    amount: '50',
                }),
                Operation.payment({
                    destination: Keypair.random().publicKey(),
                    asset: Asset.native(),
                    amount: '50',
                }),
            ];

            const builder = await StellarService.buildTransaction(
                testKeypair.publicKey(),
                operations
            );

            expect(builder).toBeDefined();
        });
    });

    describe('Transaction Signing', () => {
        const mockAccountResponse = {
            accountId: () => testKeypair.publicKey(),
            sequenceNumber: () => '3000000000000000',
        };

        beforeEach(() => {
            mockServer.loadAccount.mockResolvedValue(mockAccountResponse);
        });

        it('should sign a transaction with a single keypair', async () => {
            const transaction = await StellarService.createPaymentTransaction(
                testKeypair,
                testDestinationKeypair.publicKey(),
                '100'
            );

            StellarService.signTransaction(transaction, testKeypair);

            expect(transaction.signatures).toHaveLength(1);
        });

        it('should sign a transaction with multiple keypairs', async () => {
            const secondSigner = Keypair.random();
            const transaction = await StellarService.createPaymentTransaction(
                testKeypair,
                testDestinationKeypair.publicKey(),
                '100'
            );

            StellarService.signTransaction(transaction, testKeypair, secondSigner);

            expect(transaction.signatures).toHaveLength(2);
        });

        it('should verify if a transaction is signed by a specific keypair', async () => {
            const transaction = await StellarService.createPaymentTransaction(
                testKeypair,
                testDestinationKeypair.publicKey(),
                '100'
            );

            StellarService.signTransaction(transaction, testKeypair);

            const isSigned = StellarService.verifySignature(transaction, testKeypair.publicKey());
            expect(isSigned).toBe(true);
        });

        it('should return false when transaction is not signed by keypair', async () => {
            const transaction = await StellarService.createPaymentTransaction(
                testKeypair,
                testDestinationKeypair.publicKey(),
                '100'
            );

            StellarService.signTransaction(transaction, testKeypair);

            const otherKeypair = Keypair.random();
            const isSigned = StellarService.verifySignature(transaction, otherKeypair.publicKey());
            expect(isSigned).toBe(false);
        });

        it('should generate transaction hash', async () => {
            const transaction = await StellarService.createPaymentTransaction(
                testKeypair,
                testDestinationKeypair.publicKey(),
                '100'
            );

            const hash = StellarService.getTransactionHash(transaction);
            expect(hash).toBeDefined();
            expect(typeof hash).toBe('string');
            expect(hash.length).toBe(64);
        });
    });

    describe('Multi-Signature Scenarios', () => {
        const mockAccountResponse = {
            accountId: () => testKeypair.publicKey(),
            sequenceNumber: () => '3000000000000000',
        };

        beforeEach(() => {
            mockServer.loadAccount.mockResolvedValue(mockAccountResponse);
        });

        it('should setup multi-signature configuration', async () => {
            const secondSigner = Keypair.random();
            const config: MultiSigConfig = {
                signers: [
                    { publicKey: testKeypair.publicKey(), weight: 1 },
                    { publicKey: secondSigner.publicKey(), weight: 1 },
                ],
                threshold: 2,
            };

            const transaction = await StellarService.setupMultiSig(testKeypair, config);

            expect(transaction).toBeDefined();
            expect(transaction.operations.length).toBeGreaterThan(0);
        });

        it('should setup multi-signature with weighted signers', async () => {
            const secondSigner = Keypair.random();
            const thirdSigner = Keypair.random();
            const config: MultiSigConfig = {
                signers: [
                    { publicKey: testKeypair.publicKey(), weight: 3 },
                    { publicKey: secondSigner.publicKey(), weight: 2 },
                    { publicKey: thirdSigner.publicKey(), weight: 1 },
                ],
                threshold: 3,
            };

            const transaction = await StellarService.setupMultiSig(testKeypair, config);

            expect(transaction).toBeDefined();
        });

        it('should add a signer to an account', async () => {
            const newSigner = Keypair.random();
            const transaction = await StellarService.addSigner(
                testKeypair,
                newSigner.publicKey(),
                1
            );

            expect(transaction).toBeDefined();
            expect(transaction.operations).toHaveLength(1);
            expect(transaction.operations[0].type).toBe('setOptions');
        });

        it('should add a signer with custom weight', async () => {
            const newSigner = Keypair.random();
            const transaction = await StellarService.addSigner(
                testKeypair,
                newSigner.publicKey(),
                5
            );

            expect(transaction).toBeDefined();
        });

        it('should set account thresholds', async () => {
            const transaction = await StellarService.setAccountThresholds(
                testKeypair,
                {
                    low: 1,
                    med: 2,
                    high: 3,
                    masterWeight: 1,
                }
            );

            expect(transaction).toBeDefined();
            expect(transaction.operations).toHaveLength(1);
            expect(transaction.operations[0].type).toBe('setOptions');
        });

        it('should set partial thresholds', async () => {
            const transaction = await StellarService.setAccountThresholds(
                testKeypair,
                {
                    high: 3,
                }
            );

            expect(transaction).toBeDefined();
        });

        it('should require multiple signatures for multi-sig transaction', async () => {
            const secondSigner = Keypair.random();
            const config: MultiSigConfig = {
                signers: [
                    { publicKey: testKeypair.publicKey(), weight: 1 },
                    { publicKey: secondSigner.publicKey(), weight: 1 },
                ],
                threshold: 2,
            };

            const setupTx = await StellarService.setupMultiSig(testKeypair, config);
            StellarService.signTransaction(setupTx, testKeypair);

            expect(setupTx.signatures).toHaveLength(1);
        });
    });

    describe('Sequence Number Edge Cases', () => {
        it('should get sequence number for an account', async () => {
            const mockSequence = '3000000000000000';
            mockServer.loadAccount.mockResolvedValue({
                accountId: () => testKeypair.publicKey(),
                sequenceNumber: () => mockSequence,
            });

            const sequence = await StellarService.getSequenceNumber(testKeypair.publicKey());

            expect(sequence).toBe(mockSequence);
        });

        it('should build transaction with custom sequence number', async () => {
            const customSequence = '3000000000000005';
            mockServer.loadAccount.mockResolvedValue({
                accountId: () => testKeypair.publicKey(),
                sequenceNumber: () => '3000000000000000',
            });

            const operations = [
                Operation.payment({
                    destination: testDestinationKeypair.publicKey(),
                    asset: Asset.native(),
                    amount: '100',
                }),
            ];

            const transaction = await StellarService.buildTransactionWithCustomSequence(
                testKeypair.publicKey(),
                customSequence,
                operations
            );

            expect(transaction).toBeDefined();
        });

        it('should handle sequence number increment correctly', async () => {
            const baseSequence = '3000000000000000';
            mockServer.loadAccount.mockResolvedValue({
                accountId: () => testKeypair.publicKey(),
                sequenceNumber: () => baseSequence,
            });

            const tx1 = await StellarService.createPaymentTransaction(
                testKeypair,
                testDestinationKeypair.publicKey(),
                '100'
            );

            expect(tx1).toBeDefined();
        });

        it('should handle high sequence numbers', async () => {
            const highSequence = '9999999999999999';
            mockServer.loadAccount.mockResolvedValue({
                accountId: () => testKeypair.publicKey(),
                sequenceNumber: () => highSequence,
            });

            const sequence = await StellarService.getSequenceNumber(testKeypair.publicKey());

            expect(sequence).toBe(highSequence);
        });

        it('should throw error when account does not exist', async () => {
            mockServer.loadAccount.mockRejectedValue(new Error('Account not found'));

            await expect(
                StellarService.getSequenceNumber(testKeypair.publicKey())
            ).rejects.toThrow('Account not found');
        });
    });

    describe('Failed Submission Handling', () => {
        const mockAccountResponse = {
            accountId: () => testKeypair.publicKey(),
            sequenceNumber: () => '3000000000000000',
        };

        beforeEach(() => {
            mockServer.loadAccount.mockResolvedValue(mockAccountResponse);
        });

        it('should handle successful transaction submission', async () => {
            const mockResult = {
                hash: 'abc123def456',
                ledger: 12345,
                result_xdr: 'AAAAAg==',
            };
            mockServer.submitTransaction.mockResolvedValue(mockResult);

            const transaction = await StellarService.createPaymentTransaction(
                testKeypair,
                testDestinationKeypair.publicKey(),
                '100'
            );
            StellarService.signTransaction(transaction, testKeypair);

            const result = await StellarService.submitTransaction(transaction);

            expect(result.hash).toBe('abc123def456');
            expect(result.ledger).toBe(12345);
            expect(result.success).toBe(true);
        });

        it('should handle transaction submission failure with result XDR', async () => {
            const mockError = {
                response: {
                    data: {
                        type: 'https://stellar.org/horizon-errors/transaction_failed',
                        title: 'Transaction Failed',
                        status: 400,
                        extras: {
                            result_xdr: 'AAAAAA==',
                        },
                    },
                },
                message: 'Transaction failed',
            };
            mockServer.submitTransaction.mockRejectedValue(mockError);

            const transaction = await StellarService.createPaymentTransaction(
                testKeypair,
                testDestinationKeypair.publicKey(),
                '100'
            );
            StellarService.signTransaction(transaction, testKeypair);

            await expect(
                StellarService.submitTransaction(transaction)
            ).rejects.toThrow('Transaction submission failed');
        });

        it('should handle network errors', async () => {
            const networkError = new Error('Network timeout');
            mockServer.submitTransaction.mockRejectedValue(networkError);

            const transaction = await StellarService.createPaymentTransaction(
                testKeypair,
                testDestinationKeypair.publicKey(),
                '100'
            );
            StellarService.signTransaction(transaction, testKeypair);

            await expect(
                StellarService.submitTransaction(transaction)
            ).rejects.toThrow();
        });

        it('should handle insufficient balance error', async () => {
            const mockError = {
                response: {
                    data: {
                        type: 'https://stellar.org/horizon-errors/transaction_failed',
                        title: 'Transaction Failed',
                        status: 400,
                        extras: {
                            result_codes: {
                                operations: ['op_underfunded'],
                            },
                            result_xdr: 'AAAAAA==',
                        },
                    },
                },
                message: 'Operation underfunded',
            };
            mockServer.submitTransaction.mockRejectedValue(mockError);

            const transaction = await StellarService.createPaymentTransaction(
                testKeypair,
                testDestinationKeypair.publicKey(),
                '999999999999'
            );
            StellarService.signTransaction(transaction, testKeypair);

            await expect(
                StellarService.submitTransaction(transaction)
            ).rejects.toThrow();
        });

        it('should handle bad sequence number error', async () => {
            const mockError = {
                response: {
                    data: {
                        type: 'https://stellar.org/horizon-errors/transaction_failed',
                        title: 'Transaction Failed',
                        status: 400,
                        extras: {
                            result_codes: {
                                transaction: 'tx_bad_seq',
                            },
                            result_xdr: 'AAAAAA==',
                        },
                    },
                },
                message: 'Bad sequence',
            };
            mockServer.submitTransaction.mockRejectedValue(mockError);

            const transaction = await StellarService.createPaymentTransaction(
                testKeypair,
                testDestinationKeypair.publicKey(),
                '100'
            );
            StellarService.signTransaction(transaction, testKeypair);

            await expect(
                StellarService.submitTransaction(transaction)
            ).rejects.toThrow();
        });

        it('should handle missing signature error', async () => {
            const mockError = {
                response: {
                    data: {
                        type: 'https://stellar.org/horizon-errors/transaction_failed',
                        title: 'Transaction Failed',
                        status: 400,
                        extras: {
                            result_codes: {
                                transaction: 'tx_bad_auth',
                            },
                            result_xdr: 'AAAAAA==',
                        },
                    },
                },
                message: 'Bad auth',
            };
            mockServer.submitTransaction.mockRejectedValue(mockError);

            const transaction = await StellarService.createPaymentTransaction(
                testKeypair,
                testDestinationKeypair.publicKey(),
                '100'
            );

            await expect(
                StellarService.submitTransaction(transaction)
            ).rejects.toThrow();
        });

        it('should parse error details correctly', () => {
            const mockError = {
                response: {
                    data: {
                        type: 'https://stellar.org/horizon-errors/transaction_failed',
                        title: 'Transaction Failed',
                        status: '400',
                        extras: {
                            result_xdr: 'AAAAAA==',
                        },
                    },
                },
                message: 'Transaction failed',
            };

            const parsed = StellarService.parseError(mockError);

            expect(parsed.type).toBe('https://stellar.org/horizon-errors/transaction_failed');
            expect(parsed.code).toBe('400');
            expect(parsed.message).toBe('Transaction Failed');
            expect(parsed.resultXdr).toBe('AAAAAA==');
        });

        it('should parse unknown errors', () => {
            const error = new Error('Unknown error');
            const parsed = StellarService.parseError(error);

            expect(parsed.type).toBe('UnknownError');
            expect(parsed.message).toBe('Unknown error');
        });
    });

    describe('Account Operations', () => {
        it('should load an account', async () => {
            const mockAccount = {
                accountId: () => testKeypair.publicKey(),
                sequenceNumber: () => '3000000000000000',
            };
            mockServer.loadAccount.mockResolvedValue(mockAccount);

            const account = await StellarService.loadAccount(testKeypair.publicKey());

            expect(account).toBeDefined();
            expect(account.accountId()).toBe(testKeypair.publicKey());
        });

        it('should check if account exists', async () => {
            mockServer.loadAccount.mockResolvedValue({
                accountId: () => testKeypair.publicKey(),
            });

            const exists = await StellarService.checkAccountExists(testKeypair.publicKey());

            expect(exists).toBe(true);
        });

        it('should return false when account does not exist', async () => {
            mockServer.loadAccount.mockRejectedValue(new Error('Not found'));

            const exists = await StellarService.checkAccountExists(testKeypair.publicKey());

            expect(exists).toBe(false);
        });

        it('should get account signers', async () => {
            const mockSigners = [
                { key: testKeypair.publicKey(), weight: 1, type: 'ed25519_public_key' },
            ];
            mockServer.loadAccount.mockResolvedValue({
                accountId: () => testKeypair.publicKey(),
                signers: mockSigners,
            });

            const signers = await StellarService.getAccountSigners(testKeypair.publicKey());

            expect(signers).toEqual(mockSigners);
        });
    });

    describe('Transaction Utilities', () => {
        const mockAccountResponse = {
            accountId: () => testKeypair.publicKey(),
            sequenceNumber: () => '3000000000000000',
        };

        beforeEach(() => {
            mockServer.loadAccount.mockResolvedValue(mockAccountResponse);
        });

        it('should create transaction from XDR', async () => {
            const transaction = await StellarService.createPaymentTransaction(
                testKeypair,
                testDestinationKeypair.publicKey(),
                '100'
            );

            const xdrBase64 = transaction.toXDR();
            const restoredTx = StellarService.transactionFromXDR(xdrBase64);

            expect(restoredTx).toBeDefined();
            expect(restoredTx.operations).toHaveLength(1);
        });

        it('should generate testnet keypair', () => {
            const keypair = StellarService.generateTestnetKeypair();

            expect(keypair).toBeDefined();
            expect(keypair.publicKey()).toMatch(/^G/);
            expect(keypair.secret()).toMatch(/^S/);
        });

        it('should generate unique keypairs each time', () => {
            const keypair1 = StellarService.generateTestnetKeypair();
            const keypair2 = StellarService.generateTestnetKeypair();

            expect(keypair1.publicKey()).not.toBe(keypair2.publicKey());
            expect(keypair1.secret()).not.toBe(keypair2.secret());
        });
    });

    describe('Testnet Keypair Integration', () => {
        const mockAccountResponse = {
            accountId: () => testKeypair.publicKey(),
            sequenceNumber: () => '3000000000000000',
        };

        beforeEach(() => {
            mockServer.loadAccount.mockResolvedValue(mockAccountResponse);
        });

        it('should create payment between testnet keypairs', async () => {
            const sender = StellarService.generateTestnetKeypair();
            const receiver = StellarService.generateTestnetKeypair();

            const transaction = await StellarService.createPaymentTransaction(
                sender,
                receiver.publicKey(),
                '100',
                Asset.native()
            );

            expect(transaction).toBeDefined();
            expect(transaction.operations).toHaveLength(1);
        });

        it('should setup multi-sig with testnet keypairs', async () => {
            const primary = StellarService.generateTestnetKeypair();
            const secondary = StellarService.generateTestnetKeypair();
            const tertiary = StellarService.generateTestnetKeypair();

            const config: MultiSigConfig = {
                signers: [
                    { publicKey: primary.publicKey(), weight: 2 },
                    { publicKey: secondary.publicKey(), weight: 1 },
                    { publicKey: tertiary.publicKey(), weight: 1 },
                ],
                threshold: 2,
            };

            mockServer.loadAccount.mockResolvedValue({
                accountId: () => primary.publicKey(),
                sequenceNumber: () => '3000000000000000',
            });

            const transaction = await StellarService.setupMultiSig(primary, config);

            expect(transaction).toBeDefined();
        });

        it('should sign with multiple testnet keypairs', async () => {
            const signer1 = StellarService.generateTestnetKeypair();
            const signer2 = StellarService.generateTestnetKeypair();
            const receiver = StellarService.generateTestnetKeypair();

            mockServer.loadAccount.mockResolvedValue({
                accountId: () => signer1.publicKey(),
                sequenceNumber: () => '3000000000000000',
            });

            const transaction = await StellarService.createPaymentTransaction(
                signer1,
                receiver.publicKey(),
                '50'
            );

            StellarService.signTransaction(transaction, signer1, signer2);

            expect(transaction.signatures).toHaveLength(2);
        });
    });
});
