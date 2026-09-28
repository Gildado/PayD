/**
 * Circuit Breaker Incident Report Agent (#1312)
 *
 * Generates a report summarising circuit breaker trip incidents and
 * their root services, sourcing data from circuit_breaker_state and
 * circuit_breaker_events tables.
 *
 * Output schema:
 *   - summary: total events, by-state counts, most-tripped circuit
 *   - incidents: per-circuit trip history with timestamps and durations
 *   - rootServices: services ranked by trip frequency
 */

import type { Pool } from 'pg';
import {
  type IReportAgent,
  type ReportResult,
  type SafetyValidation,
  ReportFormat,
} from './reportSchema.js';

export interface CircuitBreakerIncidentFilters {
  organizationId?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface CircuitIncident {
  circuitName: string;
  state: string;
  failureCount: number;
  successCount: number;
  lastFailureAt: Date | null;
  openedAt: Date | null;
  updatedAt: Date;
}

export interface CircuitTransitionEvent {
  id: number;
  circuitName: string;
  fromState: string;
  toState: string;
  createdAt: Date;
}

export interface RootServiceEntry {
  circuitName: string;
  tripCount: number;
  lastTripAt: Date | null;
}

export interface CircuitBreakerIncidentReport {
  summary: {
    totalCircuits: number;
    openCircuits: number;
    halfOpenCircuits: number;
    closedCircuits: number;
    totalEvents: number;
    mostTrippedCircuit: string | null;
  };
  incidents: CircuitIncident[];
  recentTransitions: CircuitTransitionEvent[];
  rootServices: RootServiceEntry[];
}

export class CircuitBreakerIncidentReportAgent implements IReportAgent {
  id = 'circuit-breaker-incident';
  name = 'Circuit Breaker Incident Report';
  description = 'Summarises circuit breaker trip incidents and root services';

  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async execute(filters?: Record<string, any>): Promise<ReportResult> {
    const f = filters as CircuitBreakerIncidentFilters | undefined;
    const limit = f?.limit ?? 20;

    // Current circuit states
    const stateResult = await this.pool.query(
      `SELECT name, state, failure_count, success_count, last_failure_at, opened_at, updated_at
       FROM circuit_breaker_state
       ORDER BY updated_at DESC`
    );

    const incidents: CircuitIncident[] = stateResult.rows.map((row) => ({
      circuitName: row.name,
      state: row.state,
      failureCount: row.failure_count,
      successCount: row.success_count,
      lastFailureAt: row.last_failure_at,
      openedAt: row.opened_at,
      updatedAt: row.updated_at,
    }));

    const openCircuits = incidents.filter((i) => i.state === 'OPEN').length;
    const halfOpenCircuits = incidents.filter((i) => i.state === 'HALF_OPEN').length;
    const closedCircuits = incidents.filter((i) => i.state === 'CLOSED').length;

    // Transition events
    const eventConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (f?.startDate) {
      eventConditions.push(`created_at >= $${paramIndex++}`);
      params.push(f.startDate);
    }
    if (f?.endDate) {
      eventConditions.push(`created_at <= $${paramIndex++}`);
      params.push(f.endDate);
    }

    const where = eventConditions.length > 0 ? `WHERE ${eventConditions.join(' AND ')}` : '';

    const eventResult = await this.pool.query(
      `SELECT id, circuit_name, from_state, to_state, created_at
       FROM circuit_breaker_events
       ${where}
       ORDER BY created_at DESC
       LIMIT $${paramIndex}`,
      [...params, limit]
    );

    const recentTransitions: CircuitTransitionEvent[] = eventResult.rows.map((row) => ({
      id: row.id,
      circuitName: row.circuit_name,
      fromState: row.from_state,
      toState: row.to_state,
      createdAt: row.created_at,
    }));

    // Root services: count trips (transitions to OPEN) per circuit
    const rootResult = await this.pool.query(
      `SELECT circuit_name, COUNT(*)::int AS trip_count,
              MAX(created_at) AS last_trip_at
       FROM circuit_breaker_events
       WHERE to_state = 'OPEN'
       GROUP BY circuit_name
       ORDER BY trip_count DESC`
    );

    const rootServices: RootServiceEntry[] = rootResult.rows.map((row) => ({
      circuitName: row.circuit_name,
      tripCount: row.trip_count,
      lastTripAt: row.last_trip_at,
    }));

    const report: CircuitBreakerIncidentReport = {
      summary: {
        totalCircuits: incidents.length,
        openCircuits,
        halfOpenCircuits,
        closedCircuits,
        totalEvents: recentTransitions.length,
        mostTrippedCircuit: rootServices.length > 0 ? rootServices[0].circuitName : null,
      },
      incidents,
      recentTransitions,
      rootServices,
    };

    return {
      executionId: crypto.randomUUID(),
      format: ReportFormat.JSON,
      data: [report as unknown as Record<string, any>],
      summary: {
        totalRecords: incidents.length,
        processedRecords: incidents.length,
        failedRecords: 0,
        generatedAt: new Date(),
        generatedBy: 0,
      },
      metadata: {
        version: '1.0',
        schema: 'circuit-breaker-incident',
        checksum: '',
      },
    };
  }

  async validate(): Promise<SafetyValidation> {
    return { isValid: true, issues: [], piiDetected: [] };
  }
}
