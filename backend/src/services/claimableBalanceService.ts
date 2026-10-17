import { Keypair, Operation, TransactionBuilder, Asset, Claimant } from '@stellar/stellar-sdk';
import { StellarService } from './stellarService.js';
import { pool } from '../config/database.js';
import { WebhookService, WEBHOOK_EVENTS } from './webhook.service.js';
import { claimableBalanceAbuseDetectionAgent } from './claimableBalanceAbuseDetectionAgent.js';

export interface ClaimableBalanceRecord {
  id: number;
  organization_id: number;
  employee_id: number | null;
  payroll_run_id: number | null;
  payroll_item_id: number | null;
  balance_id: string;
  claimant_public_key: string | null;
  amount: string;
  asset_code: string;
  asset_issuer: string | null;
  status: 'pending' | 'claimed' | 'expired' | 'clawed_back';
  sponsor_public_key: string;
  created_at: Date;
  claimed_at: Date | null;
  expires_at: Date | null;
  notification_sent: boolean;
  notification_sent_at: Date | null;
  claim_instructions: string | null;
}

export interface CreateClaimableBalanceInput {
  organization_id: number;
  employee_id?: number;
  payroll_run_id?: number;
  payroll_item_id?: number;
  claimant_public_key: string;
  amount: string;
  asset_code: string;
  asset_issuer?: string;
  sponsor_keypair: Keypair;
  claim_instructions?: string;
  expires_in_days?: number;
}

export class ClaimableBalanceService {
  static async create(
    input: CreateClaimableBalanceInput
  ): Promise<{ record: ClaimableBalanceRecord; balance_id: string }> {
    const server = StellarService.getServer();
    const networkPassphrase = StellarService.getNetworkPassphrase();

    const asset =
      input.asset_code === 'XLM' ? Asset.native() : new Asset(input.asset_code, input.asset_issuer);

    const sponsorPublicKey = input.sponsor_keypair.publicKey();

    const sponsorAccount = await server.loadAccount(sponsorPublicKey);

    const claimants = [new Claimant(input.claimant_public_key, Claimant.predicateUnconditional())];

    const createBalanceOp = Operation.createClaimableBalance({
      asset,
      amount: input.amount,
      claimants,
    });

    const transaction = new TransactionBuilder(sponsorAccount, {
      fee: '100',
      networkPassphrase,
    })
      .addOperation(createBalanceOp)
      .setTimeout(300)
      .build();

    transaction.sign(input.sponsor_keypair);

    const simulation = await StellarService.simulateTransaction(transaction);
    if (!simulation.success) {
      throw new Error(
        `Transaction simulation failed: ${simulation.errorMessage}. ` +
          `This transaction would likely fail on-chain. Please check: ` +
          `1) Sufficient balance for ${input.amount} ${input.asset_code}, ` +
          `2) Valid account sequence, ` +
          `3) Required trustlines.`
      );
    }

    const result = await server.submitTransaction(transaction);

    const balanceId = this.extractBalanceIdFromTransaction(result.hash, result.result_xdr);

    const expiresAt = input.expires_in_days
      ? new Date(Date.now() + input.expires_in_days * 24 * 60 * 60 * 1000)
      : null;

    const claimInstructions =
      input.claim_instructions ||
      `You have a pending payment of ${input.amount} ${input.asset_code} waiting for you. ` +
        `To claim it:\n` +
        `1. Set up a Stellar wallet (recommended: Solar wallet or Lobstr)\n` +
        `2. Add a trustline for ${input.asset_code}${input.asset_issuer ? ` (Issuer: ${input.asset_issuer})` : ''}\n` +
        `3. Access your claimable balance using your wallet's balance discovery feature\n` +
        `4. The balance will be credited to your wallet once claimed`;

    const insertQuery = `
      INSERT INTO claimable_balances (
        organization_id, employee_id, payroll_run_id, payroll_item_id,
        balance_id, claimant_public_key, amount, asset_code, asset_issuer,
        status, sponsor_public_key, expires_at, claim_instructions
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const values = [
      input.organization_id,
      input.employee_id || null,
      input.payroll_run_id || null,
      input.payroll_item_id || null,
      balanceId,
      input.claimant_public_key,
      input.amount,
      input.asset_code,
      input.asset_issuer || null,
      'pending',
      sponsorPublicKey,
      expiresAt,
      claimInstructions,
    ];

    const dbResult = await pool.query(insertQuery, values);
    const record = dbResult.rows[0] as ClaimableBalanceRecord;

    this.dispatchWebhook(input.organization_id, WEBHOOK_EVENTS.CLAIMABLE_BALANCE_CREATED, {
      id: record.id,
      balance_id: balanceId,
      amount: input.amount,
      asset_code: input.asset_code,
      employee_id: input.employee_id,
      payroll_run_id: input.payroll_run_id,
    }).catch((err) => console.error('Failed to dispatch claimable_balance.created webhook:', err));

    // Non-blocking claimable balance abuse evaluation (#1203)
    claimableBalanceAbuseDetectionAgent
      .evaluateBalanceCreation({ input, balanceId })
      .catch((err) => console.error('Failed to evaluate claimable balance abuse:', err));

    return { record, balance_id: balanceId };
  }

  private static async dispatchWebhook(
    organization_id: number,
    eventType: string,
    payload: any
  ): Promise<void> {
    try {
      await WebhookService.dispatch(eventType, organization_id, payload);
    } catch (error) {
      console.error(`Webhook dispatch failed for ${eventType}:`, error);
    }
  }

  private static extractBalanceIdFromTransaction(hash: string, resultXdr: string): string {
    return `00000000-0000-0000-0000-0000000000000000000000000000000000000000000000000000000000${hash.substring(0, 8)}`;
  }

  static async findById(
    id: number,
    organization_id?: number
  ): Promise<ClaimableBalanceRecord | null> {
    let query = 'SELECT * FROM claimable_balances WHERE id = $1';
    const values: (number | string)[] = [id];

    if (organization_id) {
      query += ' AND organization_id = $2';
      values.push(organization_id);
    }

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  static async findByBalanceId(balanceId: string): Promise<ClaimableBalanceRecord | null> {
    const result = await pool.query('SELECT * FROM claimable_balances WHERE balance_id = $1', [
      balanceId,
    ]);
    return result.rows[0] || null;
  }

  static async findByEmployee(
    employeeId: number,
    organization_id: number,
    options: { status?: string; page?: number; limit?: number } = {}
  ): Promise<{ data: ClaimableBalanceRecord[]; total: number }> {
    const { status, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    let whereClause = 'employee_id = $1 AND organization_id = $2';
    const values: (number | string)[] = [employeeId, organization_id];
    let paramIndex = 3;

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      values.push(status);
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM claimable_balances WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count);

    const dataResult = await pool.query(
      `SELECT * FROM claimable_balances WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...values, limit, offset]
    );

    return { data: dataResult.rows as ClaimableBalanceRecord[], total };
  }

  static async findPendingByOrganization(
    organization_id: number,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ data: ClaimableBalanceRecord[]; total: number }> {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM claimable_balances WHERE organization_id = $1 AND status = 'pending'`,
      [organization_id]
    );
    const total = parseInt(countResult.rows[0].count);

    const dataResult = await pool.query(
      `SELECT cb.*, e.first_name, e.last_name, e.email
       FROM claimable_balances cb
       LEFT JOIN employees e ON cb.employee_id = e.id
       WHERE cb.organization_id = $1 AND cb.status = 'pending'
       ORDER BY cb.created_at DESC
       LIMIT $2 OFFSET $3`,
      [organization_id, limit, offset]
    );

    return { data: dataResult.rows as ClaimableBalanceRecord[], total };
  }

  static async markAsClaimed(balanceId: string): Promise<ClaimableBalanceRecord | null> {
    const result = await pool.query(
      `UPDATE claimable_balances
       SET status = 'claimed', claimed_at = NOW(), updated_at = NOW()
       WHERE balance_id = $1
       RETURNING *`,
      [balanceId]
    );
    const record = result.rows[0] || null;

    if (record) {
      this.dispatchWebhook(record.organization_id, WEBHOOK_EVENTS.CLAIMABLE_BALANCE_CLAIMED, {
        id: record.id,
        balance_id: balanceId,
        amount: record.amount,
        asset_code: record.asset_code,
        employee_id: record.employee_id,
        claimed_at: record.claimed_at,
      }).catch((err) =>
        console.error('Failed to dispatch claimable_balance.claimed webhook:', err)
      );
    }

    return record;
  }

  static async markNotificationSent(balanceId: string): Promise<void> {
    await pool.query(
      `UPDATE claimable_balances
       SET notification_sent = TRUE, notification_sent_at = NOW(), updated_at = NOW()
       WHERE balance_id = $1`,
      [balanceId]
    );
  }

  static async getPendingClaimsSummary(organization_id: number): Promise<{
    total_pending: number;
    total_amount: string;
    by_asset: Record<string, { count: number; amount: string }>;
  }> {
    const result = await pool.query(
      `SELECT asset_code, COUNT(*) as count, SUM(amount) as total_amount
       FROM claimable_balances
       WHERE organization_id = $1 AND status = 'pending'
       GROUP BY asset_code`,
      [organization_id]
    );

    const byAsset: Record<string, { count: number; amount: string }> = {};
    let totalPending = 0;

    for (const row of result.rows) {
      byAsset[row.asset_code] = {
        count: parseInt(row.count),
        amount: row.total_amount,
      };
      totalPending += parseInt(row.count);
    }

    const totalResult = await pool.query(
      `SELECT SUM(amount) as total FROM claimable_balances WHERE organization_id = $1 AND status = 'pending'`,
      [organization_id]
    );

    return {
      total_pending: totalPending,
      total_amount: totalResult.rows[0]?.total || '0',
      by_asset: byAsset,
    };
  }

  static async checkAndUpdateExpiredBalances(): Promise<number> {
    const result = await pool.query(
      `UPDATE claimable_balances
       SET status = 'expired', updated_at = NOW()
       WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < NOW()
       RETURNING id`
    );
    return result.rowCount || 0;
  }

  static async clawbackBalance(issuerKeypair: Keypair, balanceId: string): Promise<string> {
    const server = StellarService.getServer();
    const networkPassphrase = StellarService.getNetworkPassphrase();
    const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());

    const clawbackOp = Operation.clawbackClaimableBalance({
      balanceId,
      source: issuerKeypair.publicKey(),
    });

    const transaction = new TransactionBuilder(issuerAccount, {
      fee: '100',
      networkPassphrase,
    })
      .addOperation(clawbackOp)
      .setTimeout(30)
      .build();

    transaction.sign(issuerKeypair);

    const simulation = await StellarService.simulateTransaction(transaction);
    if (!simulation.success) {
      throw new Error(
        `Transaction simulation failed: ${simulation.errorMessage}. ` +
          `This clawback operation would likely fail. Please check the balance exists and is claimable.`
      );
    }

    const result = await server.submitTransaction(transaction);

    await pool.query(
      `UPDATE claimable_balances
       SET status = 'clawed_back', updated_at = NOW()
       WHERE balance_id = $1`,
      [balanceId]
    );

    return result.hash;
  }

  static async getClaimableBalancesForAddress(
    publicKey: string,
    sponsorPublicKey: string
  ): Promise<{ on_chain: any[]; local: ClaimableBalanceRecord[] }> {
    const server = StellarService.getServer();

    try {
      const onChainBalances = await server.claimableBalances().claimant(publicKey).call();

      const localBalances = await pool.query(
        `SELECT * FROM claimable_balances
         WHERE claimant_public_key = $1 AND sponsor_public_key = $2 AND status = 'pending'`,
        [publicKey, sponsorPublicKey]
      );

      return {
        on_chain: onChainBalances.records,
        local: localBalances.rows as ClaimableBalanceRecord[],
      };
    } catch (error) {
      console.error('Error fetching claimable balances:', error);
      return { on_chain: [], local: [] };
    }
  }

  static generateClaimInstructions(
    assetCode: string,
    assetIssuer?: string,
    amount?: string
  ): string {
    const assetInfo = assetIssuer ? `${assetCode} (Issuer: ${assetIssuer})` : assetCode;

    let instructions = `# Claim Your Pending Payment\n\n`;

    if (amount) {
      instructions += `You have **${amount} ${assetCode}** waiting for you.\n\n`;
    }

    instructions +=
      `## How to Claim\n\n` +
      `1. **Set up a Stellar wallet**\n` +
      `   - Recommended wallets: Solar, Lobstr, or Freighter\n` +
      `   - Save your recovery phrase securely\n\n` +
      `2. **Add a trustline**\n` +
      `   - Go to your wallet settings\n` +
      `   - Add trustline for: **${assetInfo}**\n` +
      `   - This allows your wallet to receive this asset\n\n` +
      `3. **Claim your balance**\n` +
      `   - Most wallets have automatic balance discovery\n` +
      `   - You can also use StellarExpert or Stellar Observer to find pending balances\n` +
      `   - The balance will appear in your wallet once discovered\n\n` +
      `## Need Help?\n\n` +
      `Contact your organization's HR department for assistance.\n`;

    return instructions;
  }
}

export const claimableBalanceService = new ClaimableBalanceService();
