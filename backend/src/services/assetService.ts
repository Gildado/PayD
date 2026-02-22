  import {
  Asset,
  Keypair,
  Operation,
  TransactionBuilder,
  AuthClawbackEnabledFlag,
  AuthRevocableFlag,
} from "@stellar/stellar-sdk";
import { StellarService } from "./stellarService";
import { pool } from "../config/database";

export class AssetService {
  /**
   * Issues the ORGUSD asset with the auth_clawback_enabled flag.
   * This flag allows the issuer to clawback assets from any account.
   */
  static async issueOrgUsdAsset(
    issuerKeypair: Keypair,
    distributorKeypair: Keypair,
    amount: string
  ): Promise<Asset> {
    const orgUsdAsset = new Asset("ORGUSD", issuerKeypair.publicKey());
    const server = StellarService.getServer();
    const networkPassphrase = StellarService.getNetworkPassphrase();

    // 1. Set the auth_clawback_enabled flag AND auth_revocable_flag on the issuer account
    // Try setting AuthRevocableFlag as well to resolve 'op_auth_revocable_required' error.
    // We cast to any because the type definition might not support bitwise OR if strict.
    // However, Stellar SDK flags are numbers.
    const setOptionsOp = Operation.setOptions({
      setFlags: (AuthClawbackEnabledFlag | AuthRevocableFlag) as any,
      source: issuerKeypair.publicKey(),
    });

    // 2. Distributor must trust the asset
    const changeTrustOp = Operation.changeTrust({
      asset: orgUsdAsset,
      source: distributorKeypair.publicKey(),
    });

    // 3. Issue the asset to the distributor
    const paymentOp = Operation.payment({
      destination: distributorKeypair.publicKey(),
      asset: orgUsdAsset,
      amount: amount,
      source: issuerKeypair.publicKey(),
    });

    // Load issuer account for sequence number
    const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());
    
    // Build transaction
    const transaction = new TransactionBuilder(issuerAccount, {
      fee: "100",
      networkPassphrase,
    })
      .addOperation(setOptionsOp)
      .addOperation(changeTrustOp) 
      .addOperation(paymentOp)
      .setTimeout(30)
      .build();

    transaction.sign(issuerKeypair);
    transaction.sign(distributorKeypair); // Distributor must sign for changeTrust

    try {
      await server.submitTransaction(transaction);
      console.log(`Successfully issued ${amount} ORGUSD to ${distributorKeypair.publicKey()}`);
      return orgUsdAsset;
    } catch (error) {
      console.error("Failed to issue ORGUSD asset:", error);
      throw error;
    }
  }

  /**
   * Claws back a specific amount of ORGUSD from a target account.
   * This action is irreversible and burns the asset.
   */
  static async clawbackAsset(
    issuerKeypair: Keypair,
    fromAccount: string,
    amount: string,
    reason?: string
  ): Promise<string> {
    const orgUsdAsset = new Asset("ORGUSD", issuerKeypair.publicKey());
    const server = StellarService.getServer();
    const networkPassphrase = StellarService.getNetworkPassphrase();

    // Load issuer account
    const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());

    // Create Clawback operation
    const clawbackOp = Operation.clawback({
      amount: amount,
      asset: orgUsdAsset,
      from: fromAccount,
      source: issuerKeypair.publicKey(),
    });

    const transaction = new TransactionBuilder(issuerAccount, {
      fee: "100",
      networkPassphrase,
    })
      .addOperation(clawbackOp)
      .setTimeout(30)
      .build();

    transaction.sign(issuerKeypair);

    try {
      const result = await server.submitTransaction(transaction);
      
      // Audit trail
      await pool.query(
        `INSERT INTO clawback_audit_logs 
        (transaction_hash, asset_code, amount, from_account, issuer_account, reason) 
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          result.hash,
          "ORGUSD",
          amount,
          fromAccount,
          issuerKeypair.publicKey(),
          reason || null
        ]
      );

      console.log(`Successfully clawed back ${amount} ORGUSD from ${fromAccount}`);
      return result.hash;
    } catch (error) {
      console.error(`Failed to clawback ORGUSD from ${fromAccount}:`, error);
      throw error;
    }
  }

  /**
   * Claws back a claimable balance of ORGUSD.
   */
  static async clawbackClaimableBalance(
    issuerKeypair: Keypair,
    balanceId: string
  ): Promise<string> {
    const server = StellarService.getServer();
    const networkPassphrase = StellarService.getNetworkPassphrase();
    const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());

    const clawbackCbOp = Operation.clawbackClaimableBalance({
      balanceId: balanceId,
      source: issuerKeypair.publicKey(),
    });

    const transaction = new TransactionBuilder(issuerAccount, {
      fee: "100",
      networkPassphrase,
    })
      .addOperation(clawbackCbOp)
      .setTimeout(30)
      .build();

    transaction.sign(issuerKeypair);

    try {
      const result = await server.submitTransaction(transaction);
      console.log(`Successfully clawed back claimable balance ${balanceId}`);
      return result.hash;
    } catch (error) {
      console.error(`Failed to clawback claimable balance ${balanceId}:`, error);
      throw error;
    }
  }
}
