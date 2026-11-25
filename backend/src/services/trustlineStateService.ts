import { pool } from '../config/database.js';
import { cacheService } from './cacheService.js';
import { trustlineCacheHits, trustlineCacheMisses, trustlineCacheInvalidations } from '../utils/metricsRegistry.js';
import logger from '../utils/logger.js';
import { TrustlineService } from './trustlineService.js';

/**
 * Trustline state: established, pending, or missing.
 */
export type TrustlineState = 'established' | 'pending' | 'missing';

/**
 * Per-employee trustline state record.
 */
export interface EmployeeTrustlineState {
  employeeId: number;
  employeeName: string;
  walletAddress: string;
  assetCode: string;
  assetIssuer: string;
  state: TrustlineState;
  balance?: string;
  lastUpdated: Date;
}

/**
 * Paginated response for trustline state endpoint.
 */
export interface PaginatedTrustlineState {
  employees: EmployeeTrustlineState[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
  };
}

/**
 * Cache key builder.
 */
function getCacheKey(organizationId: number, page: number, pageSize: number, assetCode?: string): string {
  return `trustline_state:org:${organizationId}:page:${page}:size:${pageSize}:asset:${assetCode || 'all'}`;
}

/**
 * Invalidate trustline state cache for an organization.
 * Called when trustline changes are detected.
 */
export async function invalidateTrustlineStateCache(
  organizationId: number,
  reason: string = 'trustline_change'
): Promise<void> {
  try {
    const pattern = `trustline_state:org:${organizationId}:*`;
    await cacheService.invalidatePattern(pattern);
    trustlineCacheInvalidations.inc({ reason });
    logger.debug(`Invalidated trustline state cache for org ${organizationId}`, { reason });
  } catch (error) {
    logger.warn('Trustline cache invalidation failed', error);
  }
}

/**
 * Get paginated trustline state for all employees in an organization.
 * Results are cached with 5-minute TTL.
 *
 * @param organizationId - Organization to query
 * @param page - Page number (1-indexed)
 * @param pageSize - Items per page (1-100)
 * @param assetCode - Optional filter to specific asset
 * @returns Paginated trustline states
 */
export async function getOrganizationTrustlineState(
  organizationId: number,
  page: number = 1,
  pageSize: number = 20,
  assetCode?: string
): Promise<PaginatedTrustlineState> {
  // Validate inputs
  if (page < 1) page = 1;
  if (pageSize < 1) pageSize = 1;
  if (pageSize > 100) pageSize = 100;

  // Try cache
  const cacheKey = getCacheKey(organizationId, page, pageSize, assetCode);
  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      trustlineCacheHits.inc();
      logger.debug(`Trustline state cache hit for org ${organizationId}`, { page, pageSize });
      return cached as PaginatedTrustlineState;
    }
  } catch (error) {
    logger.warn('Trustline state cache lookup failed', error);
  }

  trustlineCacheMisses.inc();

  try {
    // Query employees for this organization
    let countQuery = `
      SELECT COUNT(*) as total
      FROM employees
      WHERE organization_id = $1 AND deleted_at IS NULL AND wallet_address IS NOT NULL
    `;

    let stateQuery = `
      SELECT
        e.id as employee_id,
        e.name as employee_name,
        e.wallet_address,
        e.organization_id
      FROM employees e
      WHERE e.organization_id = $1 AND e.deleted_at IS NULL AND e.wallet_address IS NOT NULL
      ORDER BY e.id
      LIMIT $2 OFFSET $3
    `;

    const countResult = await pool.query(countQuery, [organizationId]);
    const totalItems = parseInt(countResult.rows[0]?.total || '0', 10);
    const totalPages = Math.ceil(totalItems / pageSize);
    const offset = (page - 1) * pageSize;

    const employeesResult = await pool.query(stateQuery, [organizationId, pageSize, offset]);
    const employees = employeesResult.rows;

    // For each employee, check trustline states
    const states: EmployeeTrustlineState[] = [];

    for (const emp of employees) {
      try {
        // Query stored trustline records (if any)
        const trustlineQuery = `
          SELECT asset_code, asset_issuer, established, balance, last_checked
          FROM trustlines
          WHERE employee_id = $1 AND deleted_at IS NULL
          ${assetCode ? 'AND asset_code = $2' : ''}
          ORDER BY last_checked DESC
        `;

        const params = assetCode ? [emp.employee_id, assetCode] : [emp.employee_id];
        const trustlineResult = await pool.query(trustlineQuery, params);

        if (trustlineResult.rows.length === 0) {
          // No trustline record: state is 'missing'
          states.push({
            employeeId: emp.employee_id,
            employeeName: emp.employee_name,
            walletAddress: emp.wallet_address,
            assetCode: assetCode || 'ORGUSD',
            assetIssuer: 'unknown',
            state: 'missing',
            lastUpdated: new Date(),
          });
        } else {
          // Map stored records to states
          for (const tl of trustlineResult.rows) {
            states.push({
              employeeId: emp.employee_id,
              employeeName: emp.employee_name,
              walletAddress: emp.wallet_address,
              assetCode: tl.asset_code,
              assetIssuer: tl.asset_issuer,
              state: tl.established ? 'established' : 'pending',
              balance: tl.balance,
              lastUpdated: new Date(tl.last_checked),
            });
          }
        }
      } catch (error) {
        logger.warn(`Failed to query trustlines for employee ${emp.employee_id}`, error);
        states.push({
          employeeId: emp.employee_id,
          employeeName: emp.employee_name,
          walletAddress: emp.wallet_address,
          assetCode: assetCode || 'ORGUSD',
          assetIssuer: 'unknown',
          state: 'missing',
          lastUpdated: new Date(),
        });
      }
    }

    const result: PaginatedTrustlineState = {
      employees: states,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
      },
    };

    // Cache for 5 minutes
    try {
      await cacheService.set(cacheKey, result, 300);
      logger.debug(`Trustline state cached for org ${organizationId}`, { ttl: 300 });
    } catch (error) {
      logger.warn('Trustline state cache write failed', error);
    }

    return result;
  } catch (error) {
    logger.error('Failed to query trustline state', error);
    throw error;
  }
}

/**
 * Invalidate cache when a trustline event is detected.
 * This is called by ledgerObserverService when trustlines are created.
 */
export async function handleTrustlineEvent(trustlineEvent: {
  account: string;
  assetCode: string;
  assetIssuer: string;
}): Promise<void> {
  try {
    // Find employee with this wallet address
    const result = await pool.query(
      `SELECT organization_id FROM employees WHERE wallet_address = $1 AND deleted_at IS NULL LIMIT 1`,
      [trustlineEvent.account]
    );

    if (result.rows.length > 0) {
      const orgId = result.rows[0].organization_id;
      await invalidateTrustlineStateCache(orgId, 'trustline_created');
    }
  } catch (error) {
    logger.warn('Failed to handle trustline event for cache invalidation', error);
  }
}
