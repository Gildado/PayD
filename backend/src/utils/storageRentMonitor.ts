/**
 * On-chain storage rent monitoring (#1618).
 *
 * Every Soroban ledger entry has a `liveUntilLedgerSeq` that must be
 * proactively extended before it lapses, or the entry becomes archived
 * and requires an explicit `RestoreFootprintOp` to bring back (see
 * docs/CONTRACT_ARCHIVAL_STRATEGY.md for PayD's TTL extension policy and
 * restoration runbook). This module turns "how many ledgers until this
 * entry expires" into a monitoring-friendly trend so rising rent pressure
 * is visible ahead of mainnet, not discovered when an entry archives.
 *
 * Ledger keys are network- and contract-specific XDR the caller already
 * has (e.g. from `stellar contract read` or a prior `getLedgerEntries`
 * call) — this module doesn't construct them, so it stays correct
 * regardless of any one contract's DataKey enum shape.
 */

import { rpc } from '@stellar/stellar-sdk';

/** Average Stellar ledger close time, for converting ledger counts to a human time estimate. */
const SECONDS_PER_LEDGER = 5;
const LEDGERS_PER_DAY = Math.round((24 * 60 * 60) / SECONDS_PER_LEDGER);

export type RentStatus = 'healthy' | 'watch' | 'critical' | 'expired' | 'not_found';

export interface RentCheckResult {
  contractLabel: string;
  ledgerKeyXdr: string;
  currentLedger: number;
  liveUntilLedgerSeq: number | null;
  ledgersRemaining: number | null;
  daysRemaining: number | null;
  status: RentStatus;
}

export interface RentThresholds {
  /** Below this many remaining days, status is 'critical'. Default: 3. */
  criticalDays?: number;
  /** Below this many remaining days (and above criticalDays), status is 'watch'. Default: 14. */
  watchDays?: number;
}

const DEFAULT_THRESHOLDS: Required<RentThresholds> = {
  criticalDays: 3,
  watchDays: 14,
};

function classify(daysRemaining: number, thresholds: Required<RentThresholds>): RentStatus {
  if (daysRemaining < 0) return 'expired';
  if (daysRemaining < thresholds.criticalDays) return 'critical';
  if (daysRemaining < thresholds.watchDays) return 'watch';
  return 'healthy';
}

/**
 * Checks one ledger entry's remaining TTL via Soroban RPC `getLedgerEntries`.
 * `contractLabel` is just a human-readable tag for the report (e.g.
 * "bulk_payment:Admin") — it isn't sent to the RPC.
 */
export async function checkLedgerEntryTtl(
  rpcServer: rpc.Server,
  contractLabel: string,
  ledgerKeyXdr: string,
  thresholds: RentThresholds = {}
): Promise<RentCheckResult> {
  const resolved = { ...DEFAULT_THRESHOLDS, ...thresholds };

  const [entriesResponse, latestLedgerResponse] = await Promise.all([
    rpcServer.getLedgerEntries(ledgerKeyXdr as unknown as never),
    rpcServer.getLatestLedger(),
  ]);

  const currentLedger = latestLedgerResponse.sequence;
  const entry = entriesResponse.entries?.[0];

  if (!entry || entry.liveUntilLedgerSeq == null) {
    return {
      contractLabel,
      ledgerKeyXdr,
      currentLedger,
      liveUntilLedgerSeq: null,
      ledgersRemaining: null,
      daysRemaining: null,
      status: 'not_found',
    };
  }

  const ledgersRemaining = entry.liveUntilLedgerSeq - currentLedger;
  const daysRemaining = ledgersRemaining / LEDGERS_PER_DAY;

  return {
    contractLabel,
    ledgerKeyXdr,
    currentLedger,
    liveUntilLedgerSeq: entry.liveUntilLedgerSeq,
    ledgersRemaining,
    daysRemaining,
    status: classify(daysRemaining, resolved),
  };
}

/** Checks multiple entries against the same RPC server, tolerating individual failures. */
export async function checkMultipleLedgerEntryTtls(
  rpcServer: rpc.Server,
  targets: Array<{ contractLabel: string; ledgerKeyXdr: string }>,
  thresholds: RentThresholds = {}
): Promise<RentCheckResult[]> {
  return Promise.all(
    targets.map((target) =>
      checkLedgerEntryTtl(rpcServer, target.contractLabel, target.ledgerKeyXdr, thresholds)
    )
  );
}

/** Renders results as a plain-text table for CLI/cron-log output. */
export function formatRentReport(results: RentCheckResult[]): string {
  const lines = [
    'Contract/Key'.padEnd(40) + 'Status'.padEnd(12) + 'Days Left'.padEnd(12) + 'Live Until Ledger',
    '-'.repeat(90),
  ];
  for (const r of results) {
    lines.push(
      r.contractLabel.padEnd(40) +
        r.status.padEnd(12) +
        (r.daysRemaining != null ? r.daysRemaining.toFixed(1) : 'n/a').padEnd(12) +
        String(r.liveUntilLedgerSeq ?? 'n/a')
    );
  }
  return lines.join('\n');
}
