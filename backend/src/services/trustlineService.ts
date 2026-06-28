import { Asset, TransactionBuilder, Operation } from '@stellar/stellar-sdk';
import { StellarService } from './stellarService.js';
import { pool } from '../config/database.js';

export type TrustlineStatus = 'none' | 'pending' | 'established';

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
          b.asset_type !== 'native' && b.asset_code === assetCode && b.asset_issuer === assetIssuer
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
   *
   * @param employeeId  - Employee primary key
   * @param assetCode   - Asset code to check (e.g. 'USDC', 'EURC', 'ORGUSD')
   * @param assetIssuer - Issuer Stellar address for the asset
   */
  static async refreshEmployeeTrustline(
    employeeId: number,
    assetCode: string,
    assetIssuer: string
  ): Promise<TrustlineRecord | null> {
    const empResult = await pool.query(
      'SELECT wallet_address FROM employees WHERE id = $1 AND deleted_at IS NULL',
      [employeeId]
    );

    if (empResult.rows.length === 0) return null;

    const walletAddress = empResult.rows[0].wallet_address;
    if (!walletAddress) return null;

    const { exists } = await TrustlineService.checkTrustline(walletAddress, assetCode, assetIssuer);
    const status: TrustlineStatus = exists ? 'established' : 'none';

    const result = await pool.query(
      `INSERT INTO employee_trustlines
        (employee_id, wallet_address, asset_code, asset_issuer, status, last_checked_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (employee_id, asset_code, asset_issuer)
       DO UPDATE SET status = $5, last_checked_at = NOW(), updated_at = NOW()
       RETURNING *`,
      [employeeId, walletAddress, assetCode, assetIssuer, status]
    );

    return result.rows[0];
  }

  /**
   * Get all stored trustline records for an employee from the DB.
   * Optionally filter to a specific asset code.
   */
  static async getEmployeeTrustlines(
    employeeId: number,
    assetCode?: string
  ): Promise<TrustlineRecord[]> {
    if (assetCode) {
      const result = await pool.query(
        'SELECT * FROM employee_trustlines WHERE employee_id = $1 AND asset_code = $2',
        [employeeId, assetCode]
      );
      return result.rows;
    }
    const result = await pool.query('SELECT * FROM employee_trustlines WHERE employee_id = $1', [
      employeeId,
    ]);
    return result.rows;
  }

  /**
   * Get a single trustline record for an employee.
   * Returns the first record found; to filter by asset use `getEmployeeTrustlines`.
   * @deprecated Prefer `getEmployeeTrustlines` for multi-asset support.
   */
  static async getEmployeeTrustline(employeeId: number): Promise<TrustlineRecord | null> {
    const records = await TrustlineService.getEmployeeTrustlines(employeeId);
    return records[0] ?? null;
  }

  /**
   * Build an unsigned changeTrust transaction XDR that the employee
   * wallet can sign to establish a trustline for any supported asset.
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
      fee: '100',
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
   * Mark a trustline as pending (employee has been prompted to sign).
   *
   * @param employeeId  - Employee primary key
   * @param walletAddress - Employee's Stellar wallet
   * @param assetCode   - Asset code (e.g. 'USDC', 'EURC', 'ORGUSD')
   * @param assetIssuer - Issuer address
   */
  static async markPending(
    employeeId: number,
    walletAddress: string,
    assetCode: string,
    assetIssuer: string
  ): Promise<TrustlineRecord> {
    const result = await pool.query(
      `INSERT INTO employee_trustlines
        (employee_id, wallet_address, asset_code, asset_issuer, status, last_checked_at)
       VALUES ($1, $2, $3, $4, 'pending', NOW())
       ON CONFLICT (employee_id, asset_code, asset_issuer)
       DO UPDATE SET status = 'pending', updated_at = NOW()
       RETURNING *`,
      [employeeId, walletAddress, assetCode, assetIssuer]
    );
    return result.rows[0];
  }
}
