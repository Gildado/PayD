import { pool } from '../config/database.js';
import logger from '../utils/logger.js';
import { AccessPolicy, AccessPolicyZod } from './reportSchema.js';

/**
 * User role types
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
  AUDITOR = 'AUDITOR',
  VIEWER = 'VIEWER',
}

/**
 * Report access level
 */
export enum AccessLevel {
  FULL = 'FULL', // Can read all fields
  RESTRICTED = 'RESTRICTED', // Can read specific fields
  SUMMARY = 'SUMMARY', // Can read aggregated data only
  DENIED = 'DENIED',
}

/**
 * User context for access control
 */
export interface UserContext {
  userId: number;
  organizationId: number;
  roles: UserRole[];
  departmentId?: number;
}

/**
 * Row-level security filter
 */
export interface RLSFilter {
  column: string;
  operator: '=' | '!=' | '>' | '<' | 'IN' | 'LIKE';
  value: string | string[];
}

/**
 * Report Access Control Service
 * Implements row-level security and role-based access control
 */
export class ReportAccessControl {
  /**
   * Checks if user can access a report
   */
  static async canAccessReport(
    reportId: string,
    userContext: UserContext
  ): Promise<{ allowed: boolean; accessLevel: AccessLevel; reason?: string }> {
    try {
      // Verify user belongs to organization
      const belongsToOrg = await this.verifyUserInOrganization(
        userContext.userId,
        userContext.organizationId
      );
      if (!belongsToOrg) {
        return {
          allowed: false,
          accessLevel: AccessLevel.DENIED,
          reason: 'User does not belong to this organization',
        };
      }

      // Get access policy for report
      const policy = await this.getAccessPolicy(reportId);
      if (!policy) {
        // No policy means admin-only access by default
        const isAdmin = userContext.roles.includes(UserRole.ADMIN);
        return {
          allowed: isAdmin,
          accessLevel: isAdmin ? AccessLevel.FULL : AccessLevel.DENIED,
          reason: isAdmin ? undefined : 'No access policy configured',
        };
      }

      // Evaluate access rules
      const accessLevel = await this.evaluateAccessRules(
        userContext,
        policy
      );

      const allowed = accessLevel !== AccessLevel.DENIED;
      return {
        allowed,
        accessLevel,
        reason: allowed ? undefined : 'Access denied by policy',
      };
    } catch (error) {
      logger.error('Error checking report access:', error);
      return {
        allowed: false,
        accessLevel: AccessLevel.DENIED,
        reason: 'Error evaluating access',
      };
    }
  }

  /**
   * Gets accessible fields for a user based on policy
   */
  static async getAccessibleFields(
    reportId: string,
    userContext: UserContext
  ): Promise<string[]> {
    try {
      const policy = await this.getAccessPolicy(reportId);
      if (!policy) {
        // Admin can see all fields
        return userContext.roles.includes(UserRole.ADMIN) ? [] : [];
      }

      // Collect all allowed fields from policy rules
      const allowedFields = new Set<string>();
      for (const rule of policy.rules) {
        const ruleAllows = await this.evaluateRule(userContext, rule);
        if (ruleAllows && rule.fields) {
          rule.fields.forEach((field) => allowedFields.add(field));
        }
      }

      return Array.from(allowedFields);
    } catch (error) {
      logger.error('Error getting accessible fields:', error);
      return [];
    }
  }

  /**
   * Applies row-level security filters to query
   */
  static async applyRLSFilters(
    query: string,
    reportId: string,
    userContext: UserContext
  ): Promise<string> {
    try {
      const policy = await this.getAccessPolicy(reportId);
      if (!policy || !policy.rowLevelSecurity?.enabled) {
        return query;
      }

      let filteredQuery = query;
      const filters = policy.rowLevelSecurity.filters;

      // Apply dynamic filters based on user context
      const dynamicFilters = filters.map((filter) =>
        this.buildDynamicFilter(filter, userContext)
      );

      // Add WHERE conditions or extend existing WHERE clause
      if (dynamicFilters.length > 0) {
        const whereClause = dynamicFilters
          .map((f) => `${f.column} ${f.operator} ${f.value}`)
          .join(' AND ');

        if (filteredQuery.toLowerCase().includes('where')) {
          filteredQuery = filteredQuery.replace(
            /WHERE/i,
            `WHERE ${whereClause} AND`
          );
        } else {
          filteredQuery = `${filteredQuery} WHERE ${whereClause}`;
        }
      }

      logger.info(`Applied RLS filters for user ${userContext.userId}`);
      return filteredQuery;
    } catch (error) {
      logger.error('Error applying RLS filters:', error);
      throw error;
    }
  }

  /**
   * Filters report results based on user access level
   */
  static async filterReportResults(
    results: Record<string, any>[],
    reportId: string,
    userContext: UserContext
  ): Promise<Record<string, any>[]> {
    try {
      const { allowed, accessLevel } = await this.canAccessReport(
        reportId,
        userContext
      );
      if (!allowed) {
        return [];
      }

      if (accessLevel === AccessLevel.FULL) {
        return results;
      }

      if (accessLevel === AccessLevel.SUMMARY) {
        // Return only aggregated/summary data
        return this.aggregateResults(results);
      }

      if (accessLevel === AccessLevel.RESTRICTED) {
        // Return only accessible fields
        const fields = await this.getAccessibleFields(reportId, userContext);
        if (fields.length === 0) {
          return [];
        }
        return results.map((record) => {
          const filtered: Record<string, any> = {};
          fields.forEach((field) => {
            if (field in record) {
              filtered[field] = record[field];
            }
          });
          return filtered;
        });
      }

      return [];
    } catch (error) {
      logger.error('Error filtering report results:', error);
      throw error;
    }
  }

  /**
   * Creates an access policy for a report
   */
  static async createAccessPolicy(
    reportId: string,
    policy: Omit<AccessPolicy, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<AccessPolicy> {
    try {
      const id = crypto.randomUUID();
      const now = new Date();

      const newPolicy = AccessPolicyZod.parse({
        ...policy,
        id,
        reportId,
        createdAt: now,
        updatedAt: now,
      });

      // Store in database
      await pool.query(
        `
        INSERT INTO report_access_policies
        (id, report_id, name, description, rules, row_level_security, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
        [
          newPolicy.id,
          newPolicy.reportId,
          newPolicy.name,
          newPolicy.description,
          JSON.stringify(newPolicy.rules),
          JSON.stringify(newPolicy.rowLevelSecurity),
          newPolicy.createdAt,
          newPolicy.updatedAt,
        ]
      );

      return newPolicy;
    } catch (error) {
      logger.error('Error creating access policy:', error);
      throw error;
    }
  }

  /**
   * Updates an access policy
   */
  static async updateAccessPolicy(
    policyId: string,
    updates: Partial<Omit<AccessPolicy, 'id' | 'createdAt'>>
  ): Promise<AccessPolicy> {
    try {
      const policy = await this.getAccessPolicyById(policyId);
      if (!policy) {
        throw new Error('Policy not found');
      }

      const updated = {
        ...policy,
        ...updates,
        updatedAt: new Date(),
      };

      await pool.query(
        `
        UPDATE report_access_policies
        SET name = $1, description = $2, rules = $3,
            row_level_security = $4, updated_at = $5
        WHERE id = $6
      `,
        [
          updated.name,
          updated.description,
          JSON.stringify(updated.rules),
          JSON.stringify(updated.rowLevelSecurity),
          updated.updatedAt,
          policyId,
        ]
      );

      return updated;
    } catch (error) {
      logger.error('Error updating access policy:', error);
      throw error;
    }
  }

  /**
   * Private helper: Get access policy by report ID
   */
  private static async getAccessPolicy(reportId: string): Promise<AccessPolicy | null> {
    try {
      const result = await pool.query(
        'SELECT * FROM report_access_policies WHERE report_id = $1 LIMIT 1',
        [reportId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error fetching access policy:', error);
      return null;
    }
  }

  /**
   * Private helper: Get access policy by ID
   */
  private static async getAccessPolicyById(policyId: string): Promise<AccessPolicy | null> {
    try {
      const result = await pool.query(
        'SELECT * FROM report_access_policies WHERE id = $1',
        [policyId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error fetching access policy by ID:', error);
      return null;
    }
  }

  /**
   * Private helper: Verify user belongs to organization
   */
  private static async verifyUserInOrganization(
    userId: number,
    organizationId: number
  ): Promise<boolean> {
    try {
      const result = await pool.query(
        'SELECT id FROM organization_users WHERE user_id = $1 AND organization_id = $2 LIMIT 1',
        [userId, organizationId]
      );
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error verifying user in organization:', error);
      return false;
    }
  }

  /**
   * Private helper: Evaluate access rules
   */
  private static async evaluateAccessRules(
    userContext: UserContext,
    policy: AccessPolicy
  ): Promise<AccessLevel> {
    let maxAccessLevel = AccessLevel.DENIED;

    for (const rule of policy.rules) {
      const allows = await this.evaluateRule(userContext, rule);
      if (allows) {
        if (rule.action === 'ALLOW') {
          maxAccessLevel = AccessLevel.FULL;
        }
      } else if (rule.action === 'DENY') {
        return AccessLevel.DENIED;
      }
    }

    return maxAccessLevel;
  }

  /**
   * Private helper: Evaluate a single rule
   */
  private static async evaluateRule(
    userContext: UserContext,
    rule: AccessPolicy['rules'][0]
  ): Promise<boolean> {
    switch (rule.type) {
      case 'ROLE_BASED':
        return userContext.roles.includes(rule.value as UserRole);
      case 'USER_BASED':
        return userContext.userId.toString() === rule.value;
      case 'ORG_BASED':
        return userContext.organizationId.toString() === rule.value;
      default:
        return false;
    }
  }

  /**
   * Private helper: Build dynamic filter based on user context
   */
  private static buildDynamicFilter(
    filter: RLSFilter,
    userContext: UserContext
  ): RLSFilter {
    // Replace placeholders with actual values from user context
    let value = filter.value;

    if (typeof value === 'string') {
      if (value.includes('${userId}')) {
        value = String(userContext.userId);
      }
      if (value.includes('${organizationId}')) {
        value = String(userContext.organizationId);
      }
      if (value.includes('${departmentId}')) {
        value = String(userContext.departmentId || '');
      }
    }

    return { ...filter, value };
  }

  /**
   * Private helper: Aggregate results for summary access level
   */
  private static aggregateResults(results: Record<string, any>[]): Record<string, any>[] {
    if (results.length === 0) return [];

    // Return basic aggregation
    const numericFields = Object.keys(results[0]).filter(
      (key) => typeof results[0][key] === 'number'
    );

    const aggregated: Record<string, any> = {
      totalRecords: results.length,
    };

    for (const field of numericFields) {
      const sum = results.reduce((acc, record) => acc + (record[field] || 0), 0);
      const avg = sum / results.length;
      const max = Math.max(...results.map((r) => r[field] || 0));
      const min = Math.min(...results.map((r) => r[field] || 0));

      aggregated[`${field}_sum`] = sum;
      aggregated[`${field}_avg`] = avg;
      aggregated[`${field}_max`] = max;
      aggregated[`${field}_min`] = min;
    }

    return [aggregated];
  }
}

export default ReportAccessControl;
