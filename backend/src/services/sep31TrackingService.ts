import { Pool } from 'pg';
import { config } from '../config/env.js';

const pool = new Pool({ connectionString: config.DATABASE_URL });

export type Sep31HopEntry = {
  type: string;
  [key: string]: unknown;
};

function hopsFromAnchorPayload(body: Record<string, unknown>): Sep31HopEntry[] {
  const hops: Sep31HopEntry[] = [];
  const stellarTx =
    (typeof body.stellar_transaction_id === 'string' && body.stellar_transaction_id) ||
    (Array.isArray(body.stellar_transactions) &&
      typeof body.stellar_transactions[0] === 'string' &&
      body.stellar_transactions[0]) ||
    undefined;
  if (stellarTx) {
    hops.push({ type: 'stellar_on_chain', transaction_id: stellarTx });
  }
  if (body.amount_in != null || body.amount_out != null) {
    hops.push({
      type: 'sep31_conversion',
      amount_in: body.amount_in,
      amount_out: body.amount_out,
      asset_in: body.amount_in_asset ?? body.asset_in,
      asset_out: body.amount_out_asset ?? body.asset_out,
    });
  }
  if (typeof body.external_transaction_id === 'string') {
    hops.push({ type: 'external_rail', external_transaction_id: body.external_transaction_id });
  }
  return hops;
}

export class Sep31TrackingService {
  static async recordInitiation(input: {
    organizationId: number | null;
    senderPublicKey: string;
    anchorDomain: string;
    requestPayload: unknown;
    anchorResponse: Record<string, unknown>;
  }): Promise<void> {
    const anchorTxId =
      (typeof input.anchorResponse.id === 'string' && input.anchorResponse.id) || null;
    const stellarTx =
      (typeof input.anchorResponse.stellar_transaction_id === 'string' &&
        input.anchorResponse.stellar_transaction_id) ||
      null;
    const status =
      typeof input.anchorResponse.status === 'string' ? input.anchorResponse.status : null;
    const hops = hopsFromAnchorPayload(input.anchorResponse);

    await pool.query(
      `INSERT INTO sep31_cross_border_transactions (
        organization_id, sender_public_key, anchor_domain, anchor_transaction_id,
        stellar_transaction_id, hop_ledger, status, request_payload, anchor_response_init
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb, $9::jsonb)`,
      [
        input.organizationId,
        input.senderPublicKey,
        input.anchorDomain,
        anchorTxId,
        stellarTx,
        JSON.stringify(hops),
        status,
        JSON.stringify(input.requestPayload ?? {}),
        JSON.stringify(input.anchorResponse),
      ]
    );
  }

  static async updateFromPoll(
    anchorDomain: string,
    anchorTransactionId: string,
    latest: Record<string, unknown>
  ): Promise<void> {
    const newHops = hopsFromAnchorPayload(latest);
    const status = typeof latest.status === 'string' ? latest.status : null;
    const stellarTx =
      (typeof latest.stellar_transaction_id === 'string' && latest.stellar_transaction_id) || null;

    await pool.query(
      `UPDATE sep31_cross_border_transactions
       SET anchor_response_latest = $1::jsonb,
           status = COALESCE($2, status),
           stellar_transaction_id = COALESCE($3, stellar_transaction_id),
           hop_ledger = hop_ledger || $4::jsonb,
           updated_at = NOW()
       WHERE anchor_domain = $5 AND anchor_transaction_id = $6`,
      [
        JSON.stringify(latest),
        status,
        stellarTx,
        JSON.stringify(newHops),
        anchorDomain,
        anchorTransactionId,
      ]
    );
  }
}
