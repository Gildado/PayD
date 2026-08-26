// Fixture data for CircuitBreakerIncidentReportAgent tests.

export const FIXTURE_STATE_ROWS = [
  { name: 'database', state: 'CLOSED', failure_count: 2, success_count: 5, last_failure_at: new Date('2024-06-01T10:00:00Z'), opened_at: null, updated_at: new Date('2024-06-01T10:05:00Z') },
  { name: 'redis', state: 'OPEN', failure_count: 5, success_count: 0, last_failure_at: new Date('2024-06-01T11:00:00Z'), opened_at: new Date('2024-06-01T11:00:00Z'), updated_at: new Date('2024-06-01T11:00:00Z') },
  { name: 'stellar-api', state: 'HALF_OPEN', failure_count: 3, success_count: 1, last_failure_at: new Date('2024-06-01T09:00:00Z'), opened_at: new Date('2024-06-01T09:00:00Z'), updated_at: new Date('2024-06-01T09:30:00Z') },
  { name: 'email', state: 'CLOSED', failure_count: 0, success_count: 10, last_failure_at: null, opened_at: null, updated_at: new Date('2024-06-01T08:00:00Z') },
];

export const FIXTURE_EVENT_ROWS = [
  { id: 1, circuit_name: 'redis', from_state: 'CLOSED', to_state: 'OPEN', created_at: new Date('2024-06-01T11:00:00Z') },
  { id: 2, circuit_name: 'stellar-api', from_state: 'CLOSED', to_state: 'OPEN', created_at: new Date('2024-06-01T09:00:00Z') },
  { id: 3, circuit_name: 'redis', from_state: 'OPEN', to_state: 'HALF_OPEN', created_at: new Date('2024-06-01T11:15:00Z') },
  { id: 4, circuit_name: 'database', from_state: 'CLOSED', to_state: 'OPEN', created_at: new Date('2024-05-30T08:00:00Z') },
];

export const FIXTURE_ROOT_ROWS = [
  { circuit_name: 'redis', trip_count: 3, last_trip_at: new Date('2024-06-01T11:00:00Z') },
  { circuit_name: 'database', trip_count: 2, last_trip_at: new Date('2024-05-30T08:00:00Z') },
  { circuit_name: 'stellar-api', trip_count: 1, last_trip_at: new Date('2024-06-01T09:00:00Z') },
];

export const FIXTURE_EXPECTED = {
  totalCircuits: 4,
  openCircuits: 1,
  halfOpenCircuits: 1,
  closedCircuits: 2,
  mostTrippedCircuit: 'redis',
  rootServiceCount: 3,
} as const;
