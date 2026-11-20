import { pool } from '../config/database.js';
import logger from '../utils/logger.js';
import { VestingReleaseNotificationWorkflow } from '../workflows/vestingReleaseNotificationWorkflow.js';

interface DueGrant {
  id: number;
  organization_id: number;
}

export class VestingReleaseNotificationScheduler {
  private interval: ReturnType<typeof setInterval> | null = null;
  private scanning = false;

  constructor(
    private readonly workflow = new VestingReleaseNotificationWorkflow(),
    private readonly intervalMs = 60_000
  ) {}

  start(): void {
    if (this.interval) return;
    void this.scan();
    this.interval = setInterval(() => void this.scan(), this.intervalMs);
    logger.info('Vesting release notification scheduler started', {
      intervalMs: this.intervalMs,
    });
  }

  stop(): void {
    if (!this.interval) return;
    clearInterval(this.interval);
    this.interval = null;
  }

  async scan(): Promise<void> {
    if (this.scanning) return;
    this.scanning = true;
    try {
      const due = await pool.query<DueGrant>(
        `SELECT id, organization_id FROM vesting_grants
         WHERE status = 'active'
           AND next_vesting_date IS NOT NULL
           AND next_vesting_date <= NOW()
           AND next_vesting_amount > 0
           AND NOT EXISTS (
             SELECT 1 FROM orchestration_records notification
             WHERE notification.organization_id = vesting_grants.organization_id
               AND notification.kind = 'vesting-release-notification'
               AND notification.data->>'grantId' = vesting_grants.id::text
               AND (notification.data->>'releaseDate')::timestamptz =
                   vesting_grants.next_vesting_date::timestamptz
               AND notification.status IN ('sent', 'skipped')
           )
         ORDER BY next_vesting_date ASC
         LIMIT 100`
      );
      for (const grant of due.rows) {
        const result = await this.workflow.execute(
          { id: 0, organizationId: grant.organization_id, role: 'EMPLOYER' },
          { grantId: grant.id }
        );
        if (result.status === 'failed') {
          logger.warn('Vesting release notification workflow did not complete', {
            grantId: grant.id,
            organizationId: grant.organization_id,
            executionId: result.executionId,
            errorCode: result.error?.code,
          });
        }
      }
    } catch (error) {
      logger.error('Vesting release notification scan failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      this.scanning = false;
    }
  }
}

export const vestingReleaseNotificationScheduler = new VestingReleaseNotificationScheduler();
