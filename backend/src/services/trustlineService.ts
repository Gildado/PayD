import { Asset, TransactionBuilder, Operation, Keypair } from "@stellar/stellar-sdk";
import { StellarService } from "./stellarService";
import { pool } from "../config/database";

export type TrustlineStatus = "none" | "pending" | "established";

interface TrustlineRecord {
  id: number;
  employee_id: number;
  wallet_address: string;
  asset_code: string;
  asset_issuer: string;
  status: TrustlineStatus;
  last_checked_at: string;
}

export class TrustlineService {
  /**
   * Check if a wallet has established a trustline for a given asset via Horizon.
   */
  static async checkTrustline(
    walletAddress: string,
    assetCode: string,
    assetIssuer: string
  ): Promise<{ exists: boolean; balance?: string }> {
    const server = StellarService.getServer();

    try {
      const account = await server.loadAccount(walletAddress);
      const trustline = account.balances.find(
        (b: any) =>
          b.asset_type !== "native" &&
          b.asset_code === assetCode &&
          b.asset_issuer === assetIssuer
      );

      if (trustline) {
        return { exists: true, balance: (trustline as any).balance };
      }
      return { exists: false };
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return { exists: false };
      }
      throw error;
    }
  }

  /**
   * Check trustline status for an employee and update the DB record.
   */
  static async refreshEmployeeTrustline(
    employeeId: number,
    assetIssuer: string
  ): Promise<TrustlineRecord | null> {
    const empResult = await pool.query(
      "SELECT wallet_address FROM employees WHERE id = $1 AND deleted_at IS NULL",
      [employeeId]
    );

    if (empResult.rows.length === 0) return null;

    const walletAddress = empResult.rows[0].wallet_address;
    if (!walletAddress) return null;

    const { exists } = await TrustlineService.checkTrustline(
      walletAddress,
      "ORGUSD",
      assetIssuer
    );
    const status: TrustlineStatus = exists ? "established" : "none";

    const result = await pool.query(
      `INSERT INTO employee_trustlines
        (employee_id, wallet_address, asset_code, asset_issuer, status, last_checked_at)
       VALUES ($1, $2, 'ORGUSD', $3, $4, NOW())
       ON CONFLICT (employee_id, asset_code, asset_issuer)
       DO UPDATE SET status = $4, last_checked_at = NOW(), updated_at = NOW()
       RETURNING *`,
      [employeeId, walletAddress, assetIssuer, status]
    );

    return result.rows[0];
  }

  /**
   * Get stored trustline status for an employee from the DB.
   */
  static async getEmployeeTrustline(
    employeeId: number
  ): Promise<TrustlineRecord | null> {
    const result = await pool.query(
      "SELECT * FROM employee_trustlines WHERE employee_id = $1",
      [employeeId]
    );
    return result.rows[0] || null;
  }

  /**
   * Build an unsigned changeTrust transaction XDR that the employee
   * wallet can sign to establish the ORGUSD trustline.
   */
  static async buildTrustlineTransaction(
    walletAddress: string,
    assetCode: string,
    assetIssuer: string
  ): Promise<string> {
    const server = StellarService.getServer();
    const networkPassphrase = StellarService.getNetworkPassphrase();
    const asset = new Asset(assetCode, assetIssuer);

    const account = await server.loadAccount(walletAddress);

    const transaction = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase,
    })
      .addOperation(
        Operation.changeTrust({
          asset,
          source: walletAddress,
        })
      )
      .setTimeout(300)
      .build();

    return transaction.toXDR();
  }

  /**
   * Mark a trustline as pending (employee has been prompted).
   */
  static async markPending(
    employeeId: number,
    walletAddress: string,
    assetIssuer: string
  ): Promise<TrustlineRecord> {
    const result = await pool.query(
      `INSERT INTO employee_trustlines
        (employee_id, wallet_address, asset_code, asset_issuer, status, last_checked_at)
       VALUES ($1, $2, 'ORGUSD', $3, 'pending', NOW())
       ON CONFLICT (employee_id, asset_code, asset_issuer)
       DO UPDATE SET status = 'pending', updated_at = NOW()
       RETURNING *`,
      [employeeId, walletAddress, assetIssuer]
    );
    return result.rows[0];
  }
}
