import { Keypair, Transaction } from '@stellar/stellar-sdk';
import { StellarService, MultiSigConfig } from './stellarService.js';

export interface MultiSigThresholds {
  low: number;
  med: number;
  high: number;
  masterWeight: number;
}

export interface SignerInfo {
  publicKey: string;
  weight: number;
}

export interface MultiSigStatus {
  publicKey: string;
  signers: SignerInfo[];
  thresholds: MultiSigThresholds;
  isMultiSig: boolean;
}

export class MultiSigService {
  /**
   * Computes how much "authorization weight" a signed transaction carries
   * for an m-of-n multi-sig scheme, based purely on which keys signed.
   *
   * This is useful for unit testing and for optional pre-flight guards.
   */
  static computeSignedWeight(
    transaction: Transaction,
    masterPublicKey: string,
    signers: SignerInfo[],
    thresholds: MultiSigThresholds
  ): number {
    let weight = 0;

    // Master signer weight (issuer account master key weight)
    if (StellarService.verifySignature(transaction, masterPublicKey)) {
      weight += thresholds.masterWeight;
    }

    // Additional signer weights
    for (const signer of signers) {
      if (StellarService.verifySignature(transaction, signer.publicKey)) {
        weight += signer.weight;
      }
    }

    return weight;
  }

  static canMeetThreshold(
    transaction: Transaction,
    masterPublicKey: string,
    signers: SignerInfo[],
    thresholds: MultiSigThresholds,
    level: 'low' | 'med' | 'high'
  ): boolean {
    const weight = this.computeSignedWeight(transaction, masterPublicKey, signers, thresholds);
    return weight >= thresholds[level];
  }

  /**
   * Validates that a multi-sig configuration is safe.
   * Ensures the total weight of signers can meet all thresholds to prevent lockout.
   */
  static validateMultiSigConfig(
    signers: SignerInfo[],
    thresholds: MultiSigThresholds
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const masterWeight = thresholds.masterWeight;
    const totalWeight = masterWeight + signers.reduce((sum, s) => sum + s.weight, 0);

    if (signers.length < 2) {
      errors.push('At least 2 signers are required for multi-sig.');
    }

    if (!Number.isFinite(masterWeight) || masterWeight < 0 || masterWeight > 255) {
      errors.push('masterWeight must be between 0 and 255.');
    }

    if (thresholds.low < 1) {
      errors.push('Low threshold must be at least 1.');
    }

    if (thresholds.med < thresholds.low) {
      errors.push('Medium threshold must be >= low threshold.');
    }

    if (thresholds.high < thresholds.med) {
      errors.push('High threshold must be >= medium threshold.');
    }

    if (totalWeight < thresholds.high) {
      errors.push(
        `Total signer weight (${totalWeight}) is less than high threshold (${thresholds.high}). ` +
          'This will lock the account permanently.'
      );
    }

    // Prevent unilateral authorization: no single entity (master or signer) can
    // meet the medium/high thresholds alone.
    //
    // - Medium threshold is typically required for asset issuance / payments.
    // - High threshold is required for account option changes (signers/thresholds).
    if (masterWeight >= thresholds.med) {
      errors.push(
        `Master weight (${masterWeight}) meets or exceeds the medium threshold (${thresholds.med}). ` +
          'This defeats the purpose of multi-sig.'
      );
    }

    const maxSingleSignerWeight = signers.length ? Math.max(...signers.map((s) => s.weight)) : 0;
    if (maxSingleSignerWeight >= thresholds.med && signers.length > 1) {
      errors.push(
        `Single signer has weight ${maxSingleSignerWeight} which meets or exceeds the medium threshold (${thresholds.med}). ` +
          'This defeats the purpose of multi-sig.'
      );
    }

    // Also ensure no single entity can meet the high threshold alone.
    if (masterWeight >= thresholds.high && signers.length > 1) {
      errors.push(
        `Master weight (${masterWeight}) meets or exceeds high threshold (${thresholds.high}). ` +
          'This defeats the purpose of multi-sig.'
      );
    }

    if (maxSingleSignerWeight >= thresholds.high && signers.length > 1) {
      errors.push(
        `Single signer has weight ${maxSingleSignerWeight} which meets high threshold ${thresholds.high}. ` +
          'This defeats the purpose of multi-sig.'
      );
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Configures the full multi-sig setup on the issuer account.
   */
  static async configureIssuerMultiSig(
    issuerKeypair: Keypair,
    signers: SignerInfo[],
    thresholds: MultiSigThresholds
  ): Promise<{ hash: string; ledger: number; success: boolean }> {
    // Validate before applying
    const validation = this.validateMultiSigConfig(signers, thresholds);
    if (!validation.valid) {
      throw new Error(`Invalid multi-sig config: ${validation.errors.join('; ')}`);
    }

    const config: MultiSigConfig = {
      signers,
      threshold: thresholds.med,
      lowThreshold: thresholds.low,
      medThreshold: thresholds.med,
      highThreshold: thresholds.high,
      masterWeight: thresholds.masterWeight,
    };

    const transaction = await StellarService.setupMultiSig(issuerKeypair, config);
    StellarService.signTransaction(transaction, issuerKeypair);
    return StellarService.submitTransaction(transaction);
  }

  /**
   * Adds a new signer to the issuer account.
   */
  static async addIssuerSigner(
    issuerKeypair: Keypair,
    signerPublicKey: string,
    weight: number
  ): Promise<{ hash: string; ledger: number; success: boolean }> {
    if (weight < 1 || weight > 255) {
      throw new Error('Signer weight must be between 1 and 255.');
    }

    const transaction = await StellarService.addSigner(issuerKeypair, signerPublicKey, weight);
    StellarService.signTransaction(transaction, issuerKeypair);
    return StellarService.submitTransaction(transaction);
  }

  /**
   * Removes a signer from the issuer account (sets weight to 0).
   */
  static async removeIssuerSigner(
    issuerKeypair: Keypair,
    signerPublicKey: string
  ): Promise<{ hash: string; ledger: number; success: boolean }> {
    const transaction = await StellarService.removeSigner(issuerKeypair, signerPublicKey);
    StellarService.signTransaction(transaction, issuerKeypair);
    return StellarService.submitTransaction(transaction);
  }

  /**
   * Updates the threshold configuration on the issuer account.
   */
  static async updateThresholds(
    issuerKeypair: Keypair,
    thresholds: MultiSigThresholds
  ): Promise<{ hash: string; ledger: number; success: boolean }> {
    const transaction = await StellarService.setAccountThresholds(issuerKeypair, {
      low: thresholds.low,
      med: thresholds.med,
      high: thresholds.high,
      masterWeight: thresholds.masterWeight,
    });
    StellarService.signTransaction(transaction, issuerKeypair);
    return StellarService.submitTransaction(transaction);
  }

  /**
   * Gets the current multi-sig status of an account.
   */
  static async getMultiSigStatus(publicKey: string): Promise<MultiSigStatus> {
    const signers = await StellarService.getAccountSigners(publicKey);
    const thresholds = await StellarService.getAccountThresholds(publicKey);

    const signerInfo: SignerInfo[] = signers.map((s: any) => ({
      publicKey: s.key,
      weight: s.weight,
    }));

    return {
      publicKey,
      signers: signerInfo,
      thresholds: {
        low: thresholds.lowThreshold,
        med: thresholds.medThreshold,
        high: thresholds.highThreshold,
        masterWeight: thresholds.masterWeight,
      },
      isMultiSig: signerInfo.length > 1,
    };
  }
}
