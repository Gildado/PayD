import { StrKey } from '@stellar/stellar-sdk';
import { z } from 'zod';
import { pool } from '../config/database.js';
import { getAssetIssuer } from '../config/assets.js';
import { TrustlineService } from '../services/trustlineService.js';
import {
  requireOrganization,
  WorkflowError,
  WorkflowRun,
  type WorkflowContext,
} from './runtime.js';

export const stellarAddress = z
  .string()
  .refine(StrKey.isValidEd25519PublicKey, 'Invalid Stellar public key');
export const trustlineSetupSchema = z
  .object({
    employeeId: z.number().int().positive(),
    assetCode: z.string().regex(/^[A-Za-z0-9]{1,12}$/),
    assetIssuer: stellarAddress.optional(),
  })
  .strict();

export async function scopedEmployee(
  context: WorkflowContext,
  employeeId: number
): Promise<string> {
  const organizationId = requireOrganization(context);
  const result = await pool.query<{ wallet_address: string }>(
    `SELECT wallet_address FROM employees
     WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
    [employeeId, organizationId]
  );
  const wallet = result.rows[0]?.wallet_address;
  if (
    !wallet ||
    !StrKey.isValidEd25519PublicKey(wallet) ||
    (context.role !== 'EMPLOYER' && context.walletAddress !== wallet)
  ) {
    throw new WorkflowError('NOT_FOUND', 'Employee wallet not found in your scope.', 404);
  }
  return wallet;
}

export class TrustlineSetupWorkflow {
  constructor(
    private readonly trustlines = TrustlineService,
    private readonly delayMs = 100
  ) {}

  async execute(context: WorkflowContext, input: z.infer<typeof trustlineSetupSchema>) {
    const run = new WorkflowRun('trustline-setup', context, this.delayMs);
    return run.execute(async () => {
      const organizationId = requireOrganization(context);
      input = trustlineSetupSchema.parse(input);
      const wallet = await run.step('resolve-employee', () =>
        scopedEmployee(context, input.employeeId)
      );
      // XLM needs no trustline and must never build a changeTrust operation.
      if (input.assetCode === 'XLM') return { status: 'established' as const };
      const issuer = input.assetIssuer ?? getAssetIssuer(input.assetCode);
      if (!issuer || !StrKey.isValidEd25519PublicKey(issuer)) {
        throw new WorkflowError('INVALID_ASSET', 'A valid asset issuer is required.');
      }
      const record = await run.step('refresh-trustline', () =>
        this.trustlines.refreshEmployeeTrustline(
          input.employeeId,
          organizationId,
          input.assetCode,
          issuer
        )
      );
      if (!record || record.wallet_address !== wallet) {
        throw new WorkflowError('CONFLICT', 'Employee wallet changed. Start setup again.', 409);
      }
      if (record.status === 'established') return { status: 'established' as const };
      const unsignedXdr = await run.step('build-change-trust', () =>
        this.trustlines.buildTrustlineTransaction(wallet, input.assetCode, issuer)
      );
      await run.step('mark-pending', () =>
        this.trustlines.markPending(input.employeeId, wallet, input.assetCode, issuer)
      );
      return { status: 'awaiting_signature' as const, unsignedXdr };
    });
  }
}
