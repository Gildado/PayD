/**
 * Contract Upgrade API Service
 *
 * Thin fetch wrapper over the /api/v1/contracts endpoints.
 * All functions throw on non-2xx responses so callers only need
 * to handle the happy-path; errors bubble up to try/catch in hooks.
 *
 * No in-module state — every call is a pure async function.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = '/api/v1/contracts';

// ---------------------------------------------------------------------------
// Types (mirror backend service types)
// ---------------------------------------------------------------------------

export interface ContractRecord {
  id: number;
  name: string;
  description: string | null;
  network: string;
  contract_id: string;
  current_wasm_hash: string;
  version: string;
  last_upgraded_at: string | null;
  last_upgraded_by: string | null;
  created_at: string;
}

export interface MigrationStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  message: string | null;
}

export type UpgradeLogStatus =
  | 'pending'
  | 'simulated'
  | 'confirmed'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface UpgradeSimulationResult {
  success: boolean;
  estimatedFee: string;
  estimatedFeeXlm: string;
  cpuInstructions: string;
  memoryBytes: string;
  latestLedger: number;
  transactionData: string | null;
  warnings: string[];
  error: string | null;
}

export interface UpgradeLog {
  id: number;
  registry_id: number;
  previous_wasm_hash: string;
  new_wasm_hash: string;
  status: UpgradeLogStatus;
  simulation_result: UpgradeSimulationResult | null;
  tx_hash: string | null;
  migration_steps: MigrationStep[];
  initiated_by: string;
  notes: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Executes a fetch and throws a typed Error if the response is not 2xx.
 * Extracts the backend error message when available.
 *
 * Time/space: O(1) per call.
 */
async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  const body = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    const message =
      (body.error as string | undefined) ??
      (body.message as string | undefined) ??
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return body as T;
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

/**
 * List all registered Soroban contracts.
 *
 * GET /api/v1/contracts
 */
export async function fetchContracts(): Promise<ContractRecord[]> {
  const data = await apiFetch<{ success: boolean; data: ContractRecord[] }>(API_BASE);
  return data.data;
}

/**
 * Fetch a single contract by its registry ID.
 *
 * GET /api/v1/contracts/:registryId
 */
export async function fetchContract(registryId: number): Promise<ContractRecord> {
  const data = await apiFetch<{ success: boolean; data: ContractRecord }>(
    `${API_BASE}/${registryId}`
  );
  return data.data;
}

/**
 * Validate a candidate WASM hash against format rules and on-chain existence.
 *
 * POST /api/v1/contracts/:registryId/validate-hash
 * Returns { valid, reason? }
 */
export async function validateWasmHash(
  registryId: number,
  newWasmHash: string
): Promise<{ valid: boolean; reason?: string }> {
  const data = await apiFetch<{ success: boolean; valid: boolean; reason?: string }>(
    `${API_BASE}/${registryId}/validate-hash`,
    {
      method: 'POST',
      body: JSON.stringify({ newWasmHash }),
    }
  );
  return { valid: data.valid, reason: data.reason };
}

/**
 * Simulate the upgrade transaction and create an upgrade log row.
 *
 * POST /api/v1/contracts/:registryId/simulate-upgrade
 * Returns upgradeLogId and simulation cost details.
 */
export async function simulateUpgrade(
  registryId: number,
  newWasmHash: string,
  initiatedBy: string,
  notes?: string
): Promise<{ upgradeLogId: number; simulation: UpgradeSimulationResult; message: string }> {
  return apiFetch(`${API_BASE}/${registryId}/simulate-upgrade`, {
    method: 'POST',
    body: JSON.stringify({ newWasmHash, initiatedBy, notes }),
  });
}

/**
 * Execute a previously simulated upgrade on-chain.
 *
 * POST /api/v1/contracts/upgrade-logs/:logId/execute
 * Body: { adminSecret }
 */
export async function executeUpgrade(
  upgradeLogId: number,
  adminSecret: string
): Promise<{ upgradeLogId: number; txHash: string; status: string; message: string }> {
  return apiFetch(`${API_BASE}/upgrade-logs/${upgradeLogId}/execute`, {
    method: 'POST',
    body: JSON.stringify({ adminSecret }),
  });
}

/**
 * Poll the current migration status of an upgrade log.
 *
 * GET /api/v1/contracts/upgrade-logs/:logId/status
 */
export async function fetchUpgradeStatus(upgradeLogId: number): Promise<UpgradeLog> {
  const data = await apiFetch<{ success: boolean; data: UpgradeLog }>(
    `${API_BASE}/upgrade-logs/${upgradeLogId}/status`
  );
  return data.data;
}

/**
 * Cancel a pending or simulated upgrade.
 *
 * POST /api/v1/contracts/upgrade-logs/:logId/cancel
 */
export async function cancelUpgrade(upgradeLogId: number): Promise<void> {
  await apiFetch(`${API_BASE}/upgrade-logs/${upgradeLogId}/cancel`, { method: 'POST' });
}

/**
 * Fetch paginated upgrade history for a contract.
 *
 * GET /api/v1/contracts/:registryId/upgrade-logs?page=1&limit=20
 */
export async function fetchUpgradeLogs(
  registryId: number,
  page = 1,
  limit = 20
): Promise<{ data: UpgradeLog[]; total: number; page: number; limit: number }> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  return apiFetch(`${API_BASE}/${registryId}/upgrade-logs?${params}`);
}
