import { Transaction } from '@stellar/stellar-sdk';
import { StellarService, TransactionResult } from './stellarService.js';
import {
  StellarThrottlingService,
  ThrottledTransactionOptions,
} from './stellarThrottlingService.js';
import logger from '../utils/logger.js';

/**
 * Extended Stellar service with built-in throttling support
 * This is a convenience wrapper that combines StellarService with StellarThrottlingService
 */
export class StellarServiceWithThrottling {
  private static throttlingService = StellarThrottlingService.getInstance();

  /**
   * Submit a transaction with automatic throttling
   * @param transaction - The Stellar transaction to submit
   * @param options - Throttling options
   * @returns Transaction result
   */
  static async submitTransactionThrottled(
    transaction: Transaction,
    options?: ThrottledTransactionOptions
  ): Promise<TransactionResult> {
    return this.throttlingService.submitTransaction(transaction, options);
  }

  /**
   * Submit a transaction without throttling (direct submission)
   * Use this for critical operations that should bypass throttling
   * @param transaction - The Stellar transaction to submit
   * @returns Transaction result
   */
  static async submitTransactionDirect(transaction: Transaction): Promise<TransactionResult> {
    logger.warn('Submitting transaction without throttling - use sparingly');
    return StellarService.submitTransaction(transaction);
  }

  /**
   * Check if throttling service has capacity
   * @returns true if can accept more transactions
   */
  static hasThrottlingCapacity(): boolean {
    return this.throttlingService.hasCapacity();
  }

  /**
   * Get current throttling status
   */
  static getThrottlingStatus() {
    return this.throttlingService.getStatus();
  }

  /**
   * Get throttling metrics
   */
  static getThrottlingMetrics() {
    return this.throttlingService.getMetrics();
  }

  // Re-export all StellarService methods for convenience
  static getServer = StellarService.getServer;
  static getNetworkPassphrase = StellarService.getNetworkPassphrase;
  static resetServer = StellarService.resetServer;
  static loadAccount = StellarService.loadAccount;
  static getSequenceNumber = StellarService.getSequenceNumber;
  static buildTransaction = StellarService.buildTransaction;
  static createPaymentTransaction = StellarService.createPaymentTransaction;
  static signTransaction = StellarService.signTransaction;
  static simulateTransaction = StellarService.simulateTransaction;
  static simulateAndSubmit = StellarService.simulateAndSubmit;
  static setupMultiSig = StellarService.setupMultiSig;
  static removeSigner = StellarService.removeSigner;
  static getAccountThresholds = StellarService.getAccountThresholds;
  static addSigner = StellarService.addSigner;
  static setAccountThresholds = StellarService.setAccountThresholds;
  static buildTransactionWithCustomSequence = StellarService.buildTransactionWithCustomSequence;
  static verifySignature = StellarService.verifySignature;
  static getTransactionHash = StellarService.getTransactionHash;
  static transactionFromXDR = StellarService.transactionFromXDR;
  static getAccountSigners = StellarService.getAccountSigners;
  static checkAccountExists = StellarService.checkAccountExists;
  static generateTestnetKeypair = StellarService.generateTestnetKeypair;
  static parseError = StellarService.parseError;
}

export default StellarServiceWithThrottling;
