import {
  Account,
  Horizon,
  Networks,
  Keypair,
  TransactionBuilder,
  Operation,
  Asset,
  Transaction,
  xdr,
  Memo,
  AuthClawbackEnabledFlag,
  AuthRevocableFlag,
  Signer,
  SignerKey,
  StrKey,
} from '@stellar/stellar-sdk';
import axios from 'axios';
import { withRetry } from '../utils/retry.js';

export interface TransactionResult {
  hash: string;
  ledger: number;
  success: boolean;
  resultXdr?: string;
}

export interface SimulationResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  errorMessage?: string;
  operationsResults?: Array<{
    code: string;
    message: string;
  }>;
  feeCharged?: string;
  minFeeRequired?: string;
  latestLedger?: number;
}

export class SimulationError extends Error {
  constructor(
    message: string,
    public readonly simulationResult?: SimulationResult
  ) {
    super(message);
    this.name = 'SimulationError';
  }
}

export interface MultiSigConfig {
  signers: Array<{
    publicKey: string;
    weight: number;
  }>;
  threshold: number;
  lowThreshold?: number;
  medThreshold?: number;
  highThreshold?: number;
  masterWeight?: number;
}

export class StellarService {
  private static server: Horizon.Server | null = null;
  private static network: string | null = null;

  static getServer(): Horizon.Server {
    if (!this.server) {
      const url = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
      this.server = new Horizon.Server(url);
    }
    return this.server;
  }

  static getNetworkPassphrase(): string {
    if (!this.network) {
      this.network = process.env.STELLAR_NETWORK === 'public' ? Networks.PUBLIC : Networks.TESTNET;
    }
    return this.network;
  }

  static resetServer(): void {
    this.server = null;
    this.network = null;
  }

  static async loadAccount(publicKey: string): Promise<Horizon.AccountResponse> {
    const server = this.getServer();
    return withRetry(() => server.loadAccount(publicKey));
  }

  static async getSequenceNumber(publicKey: string): Promise<string> {
    const account = await this.loadAccount(publicKey);
    return account.sequenceNumber();
  }

  static async buildTransaction(
    sourcePublicKey: string,
    operations: xdr.Operation[],
    options: {
      fee?: string;
      timeout?: number;
      memo?: Memo;
    } = {}
  ): Promise<TransactionBuilder> {
    const server = this.getServer();
    const networkPassphrase = this.getNetworkPassphrase();
    const account = await server.loadAccount(sourcePublicKey);

    const builder = new TransactionBuilder(account, {
      fee: options.fee || '100',
      networkPassphrase,
    });

    operations.forEach((op) => builder.addOperation(op));

    if (options.memo) {
      builder.addMemo(options.memo);
    }

    builder.setTimeout(options.timeout || 30);

    return builder;
  }

  static async createPaymentTransaction(
    sourceKeypair: Keypair,
    destinationPublicKey: string,
    amount: string,
    asset: Asset = Asset.native(),
    options: {
      fee?: string;
      timeout?: number;
      memo?: Memo;
    } = {}
  ): Promise<Transaction> {
    const builder = await this.buildTransaction(
      sourceKeypair.publicKey(),
      [
        Operation.payment({
          destination: destinationPublicKey,
          asset,
          amount,
        }),
      ],
      options
    );

    return builder.build();
  }

  static signTransaction(transaction: Transaction, ...signers: Keypair[]): Transaction {
    signers.forEach((signer) => transaction.sign(signer));
    return transaction;
  }

  static async submitTransaction(transaction: Transaction): Promise<TransactionResult> {
    const server = this.getServer();

    try {
      const result = await withRetry(() => server.submitTransaction(transaction));
      return {
        hash: result.hash,
        ledger: result.ledger,
        success: true,
        resultXdr: result.result_xdr,
      };
    } catch (error: any) {
      const resultXdr = error.response?.data?.extras?.result_xdr;
      throw new Error(
        `Transaction submission failed: ${error.message}${resultXdr ? ` - Result XDR: ${resultXdr}` : ''}`
      );
    }
  }

  static async simulateTransaction(transaction: Transaction): Promise<SimulationResult> {
    const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';

    try {
      const txXdr = transaction.toXDR();

      const response = await axios.post(
        `${horizonUrl}/transactions`,
        { tx: txXdr },
        { headers: { 'Content-Type': 'application/json' } }
      );

      const data = response.data;
      const latestLedger = data.latest_ledger;

      if (data.error) {
        return {
          success: false,
          error: data.error,
          errorCode: 'tx_sim_failed',
          errorMessage: data.error,
          latestLedger,
        };
      }

      if (data.result) {
        const resultXdr = data.result;
        const txResult = xdr.TransactionResult.fromXDR(resultXdr, 'base64');
        const operations = txResult.result().results();

        const operationResults: Array<{ code: string; message: string }> = [];
        let hasFailedOp = false;

        for (const opResult of operations) {
          const opValue = opResult.value();
          if (opValue) {
            const switchValue = (opValue as any).switch?.();
            const code = switchValue?.name || 'op_success';
            const message = switchValue?.name || 'Success';
            operationResults.push({ code, message });

            if (code !== 'op_success') {
              hasFailedOp = true;
            }
          }
        }

        if (hasFailedOp) {
          return {
            success: false,
            errorCode: 'ops_failed',
            errorMessage: 'One or more operations failed during simulation',
            operationsResults: operationResults,
            latestLedger,
          };
        }

        return {
          success: true,
          operationsResults: operationResults,
          feeCharged: data.fee_charged || '100',
          latestLedger,
        };
      }

      return {
        success: true,
        latestLedger,
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message;

      if (error.response?.data?.extras?.result_codes) {
        const resultCodes = error.response.data.extras.result_codes;
        return {
          success: false,
          error: resultCodes.operations?.join(', ') || resultCodes.transaction || 'Unknown error',
          errorCode: resultCodes.transaction || 'tx_sim_failed',
          errorMessage: `Simulation failed: ${resultCodes.operations?.join(', ') || resultCodes.transaction || errorMessage}`,
        };
      }

      return {
        success: false,
        error: errorMessage,
        errorCode: 'simulation_error',
        errorMessage: `Simulation error: ${errorMessage}`,
      };
    }
  }

  static async simulateAndSubmit(transaction: Transaction): Promise<TransactionResult> {
    const simulation = await this.simulateTransaction(transaction);

    if (!simulation.success) {
      throw new SimulationError(
        `Transaction simulation failed: ${simulation.errorMessage}`,
        simulation
      );
    }

    return this.submitTransaction(transaction);
  }

  static async setupMultiSig(
    sourceKeypair: Keypair,
    config: MultiSigConfig,
    options: {
      fee?: string;
      timeout?: number;
    } = {}
  ): Promise<Transaction> {
    const lowT = config.lowThreshold ?? config.threshold;
    const medT = config.medThreshold ?? config.threshold;
    const highT = config.highThreshold ?? config.threshold;
    const mw =
      config.masterWeight ??
      config.signers.find((s) => s.publicKey === sourceKeypair.publicKey())?.weight ??
      1;

    const builder = await this.buildTransaction(
      sourceKeypair.publicKey(),
      [
        Operation.setOptions({
          masterWeight: mw,
          lowThreshold: lowT,
          medThreshold: medT,
          highThreshold: highT,
          signer: undefined,
        }),
        ...config.signers
          .filter((s) => s.publicKey !== sourceKeypair.publicKey())
          .map((signer) =>
            Operation.setOptions({
              signer: {
                ed25519PublicKey: signer.publicKey,
                weight: signer.weight,
              },
            })
          ),
      ],
      options
    );

    return builder.build();
  }

  static async removeSigner(
    sourceKeypair: Keypair,
    signerPublicKey: string,
    options: {
      fee?: string;
      timeout?: number;
    } = {}
  ): Promise<Transaction> {
    return this.addSigner(sourceKeypair, signerPublicKey, 0, options);
  }

  static async getAccountThresholds(publicKey: string): Promise<{
    lowThreshold: number;
    medThreshold: number;
    highThreshold: number;
    masterWeight: number;
  }> {
    const account = await this.loadAccount(publicKey);
    const masterSigner = account.signers.find((s: any) => s.key === publicKey);
    return {
      lowThreshold: account.thresholds.low_threshold,
      medThreshold: account.thresholds.med_threshold,
      highThreshold: account.thresholds.high_threshold,
      masterWeight: masterSigner?.weight ?? 0,
    };
  }

  static async addSigner(
    sourceKeypair: Keypair,
    signerPublicKey: string,
    weight: number,
    options: {
      fee?: string;
      timeout?: number;
    } = {}
  ): Promise<Transaction> {
    const builder = await this.buildTransaction(
      sourceKeypair.publicKey(),
      [
        Operation.setOptions({
          signer: {
            ed25519PublicKey: signerPublicKey,
            weight,
          },
        }),
      ],
      options
    );

    return builder.build();
  }

  static async setAccountThresholds(
    sourceKeypair: Keypair,
    thresholds: {
      low?: number;
      med?: number;
      high?: number;
      masterWeight?: number;
    },
    options: {
      fee?: string;
      timeout?: number;
    } = {}
  ): Promise<Transaction> {
    const builder = await this.buildTransaction(
      sourceKeypair.publicKey(),
      [
        Operation.setOptions({
          lowThreshold: thresholds.low,
          medThreshold: thresholds.med,
          highThreshold: thresholds.high,
          masterWeight: thresholds.masterWeight,
        }),
      ],
      options
    );

    return builder.build();
  }

  static async buildTransactionWithCustomSequence(
    sourcePublicKey: string,
    sequenceNumber: string,
    operations: xdr.Operation[],
    options: {
      fee?: string;
      timeout?: number;
      memo?: Memo;
    } = {}
  ): Promise<Transaction> {
    const server = this.getServer();
    const networkPassphrase = this.getNetworkPassphrase();

    const account = await server.loadAccount(sourcePublicKey);
    const customAccount = new Account(sourcePublicKey, sequenceNumber);

    const builder = new TransactionBuilder(customAccount, {
      fee: options.fee || '100',
      networkPassphrase,
    });

    operations.forEach((op) => builder.addOperation(op));

    if (options.memo) {
      builder.addMemo(options.memo);
    }

    builder.setTimeout(options.timeout || 30);

    return builder.build();
  }

  static verifySignature(transaction: Transaction, publicKey: string): boolean {
    const rawSig = transaction.signatures.find((sig) => {
      const keypair = Keypair.fromPublicKey(publicKey);
      return sig.hint().toString('base64') === keypair.signatureHint().toString('base64');
    });
    return !!rawSig;
  }

  static getTransactionHash(transaction: Transaction): string {
    return transaction.hash().toString('hex');
  }

  static transactionFromXDR(xdrBase64: string): Transaction {
    return new Transaction(xdrBase64, this.getNetworkPassphrase());
  }

  static async getAccountSigners(publicKey: string): Promise<any[]> {
    const server = this.getServer();
    const account = await server.loadAccount(publicKey);
    return account.signers;
  }

  static async checkAccountExists(publicKey: string): Promise<boolean> {
    try {
      await this.loadAccount(publicKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  static generateTestnetKeypair(): Keypair {
    return Keypair.random();
  }

  static parseError(error: any): {
    type: string;
    code?: string;
    message: string;
    resultXdr?: string;
  } {
    if (error.response?.data) {
      const data = error.response.data;
      return {
        type: data.type || 'HorizonError',
        code: data.status,
        message: data.title || error.message,
        resultXdr: data.extras?.result_xdr,
      };
    }
    return {
      type: 'UnknownError',
      message: error.message || 'Unknown error occurred',
    };
  }
}
