import { z } from 'zod';
import { pool } from '../config/database.js';
import searchService, { SearchService } from '../services/searchService.js';
import logger from '../utils/logger.js';
import { withSpan } from '../utils/tracing.js';
import {
  requireOrganization,
  WorkflowError,
  WorkflowRun,
  type WorkflowContext,
} from './runtime.js';

export const searchIndexRebuildSchema = z
  .object({
    targetEntity: z.enum(['employees', 'all']).default('employees'),
    batchSize: z.number().int().positive().default(100),
    force: z.boolean().default(false),
  })
  .strict();

export interface SearchIndexRebuildOutcome {
  status: 'completed';
  targetEntity: string;
  organizationId: number;
  recordsIndexed: number;
  durationMs: number;
  completedAt: string;
}

export class SearchIndexRebuildWorkflow {
  constructor(
    private readonly search = searchService,
    private readonly db = pool,
    private readonly delayMs = 100
  ) {}

  async execute(
    context: WorkflowContext,
    input: z.infer<typeof searchIndexRebuildSchema>
  ) {
    const run = new WorkflowRun('search-index-rebuild', context, this.delayMs);
    return run.execute<SearchIndexRebuildOutcome>(async () => {
      // Rebuilding indexes requires employer/admin authorization
      const organizationId = requireOrganization(context, true);
      input = searchIndexRebuildSchema.parse(input);
      const startTime = Date.now();

      // Step 1: Check entity counts and index readiness
      const recordCount = await run.step<number>(
        'check-index-status',
        async () => {
          const countResult = await this.db.query<{ count: string }>(
            `SELECT COUNT(*) as count
             FROM employees
             WHERE organization_id = $1 AND deleted_at IS NULL`,
            [organizationId]
          );

          const total = parseInt(countResult.rows[0]?.count || '0', 10);
          return total;
        }
      );

      // Step 2: Rebuild search_vector for employee records
      const indexedCount = await run.step<number>(
        'rebuild-search-index',
        async () => {
          const updateResult = await this.db.query(
            `UPDATE employees
             SET search_vector = to_tsvector(
               'english',
               coalesce(first_name, '') || ' ' ||
               coalesce(last_name, '') || ' ' ||
               coalesce(email, '') || ' ' ||
               coalesce(department, '') || ' ' ||
               coalesce(position, '') || ' ' ||
               coalesce(wallet_address, '')
             ),
             updated_at = NOW()
             WHERE organization_id = $1 AND deleted_at IS NULL`,
            [organizationId]
          );

          const rowCount = updateResult.rowCount ?? recordCount;
          logger.info('Rebuilt employee search vectors', {
            organizationId,
            rowCount,
            executionId: run.executionId,
          });
          return rowCount;
        },
        true // safe to retry transient database errors
      );

      // Step 3: Verify index integrity using searchService
      await run.step(
        'verify-index-integrity',
        async () => {
          const probeResult = await this.search.searchEmployees(organizationId, {
            limit: 1,
            page: 1,
          });

          if (!probeResult || !probeResult.pagination) {
            throw new WorkflowError(
              'INDEX_VERIFICATION_FAILED',
              'Search index verification probe failed to return pagination metadata.'
            );
          }

          return { verified: true, total: probeResult.pagination.total };
        },
        true // safe to retry read operations
      );

      const durationMs = Date.now() - startTime;
      logger.info('Search index rebuild workflow completed', {
        organizationId,
        targetEntity: input.targetEntity,
        indexedCount,
        durationMs,
        executionId: run.executionId,
      });

      return {
        status: 'completed' as const,
        targetEntity: input.targetEntity,
        organizationId,
        recordsIndexed: indexedCount,
        durationMs,
        completedAt: new Date().toISOString(),
      };
    });
  }
}
