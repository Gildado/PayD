# Storage Rent Cost Monitoring

Part of the mainnet launch readiness initiative (#1618). Tracks rising
Soroban storage rent pressure across PayD's contracts ahead of mainnet, so
an entry approaching its TTL is caught by monitoring, not discovered as an
archived-entry error in production.

## Why this exists

`docs/CONTRACT_ARCHIVAL_STRATEGY.md` documents *how* each contract
proactively extends its own persistent/temporary entries (thresholds,
extend-to targets, and the restoration runbook for an entry that lapsed
anyway). This doc covers the complementary *off-chain observability* piece:
a way to see, ahead of time, which entries are trending toward their
threshold — across all 8 contracts, without waiting for an on-chain error.

## Implementation

- `backend/src/utils/storageRentMonitor.ts` — `checkLedgerEntryTtl()` /
  `checkMultipleLedgerEntryTtls()` query a ledger entry's
  `liveUntilLedgerSeq` via Soroban RPC `getLedgerEntries`, compute ledgers
  and estimated days remaining, and classify the result as `healthy`,
  `watch` (< 14 days), `critical` (< 3 days), `expired`, or `not_found`
  (already archived).
- `formatRentReport()` renders results as a plain-text table suitable for
  cron/CI log output.
- Unit tests (`backend/src/utils/__tests__/storageRentMonitor.test.ts`)
  cover all five status classifications against a mocked RPC server — no
  live network or contract required to verify the classification logic.

## Wiring it into a scheduled check

The module takes ledger-key XDR + a human label per entry you want
watched — it deliberately does not construct Soroban `LedgerKey` XDR
itself, since the encoding is specific to each contract's `DataKey` enum
shape and guessing it wrong would silently monitor the wrong entry. Get the
XDR for a key you care about (e.g. via `stellar contract read` or a
one-off `getLedgerEntries` call), then:

```ts
import { rpc } from '@stellar/stellar-sdk';
import { checkMultipleLedgerEntryTtls, formatRentReport } from './utils/storageRentMonitor.js';

const server = new rpc.Server(config.stellar.sorobanRpcUrl);

const results = await checkMultipleLedgerEntryTtls(server, [
  { contractLabel: 'bulk_payment:Admin', ledgerKeyXdr: '<xdr from stellar contract read>' },
  { contractLabel: 'orgusd:Admin', ledgerKeyXdr: '<xdr from stellar contract read>' },
  // ... one entry per contract's critical persistent key
]);

console.log(formatRentReport(results));
// wire `results.some(r => r.status === 'critical')` into your alerting
// path of choice (see anomalousFundMovementAlertService.ts's onAlert
// pattern for a pluggable-handler example).
```

Recommended cadence: daily, well inside the `watch` threshold's 14-day
window, so a `watch`-status entry has time to be triaged before it ever
reaches `critical`.

## Thresholds

Defaults (overridable per call via `RentThresholds`):

- `watchDays: 14` — first signal that an entry needs attention soon.
- `criticalDays: 3` — escalate; extend the TTL before the next check cycle.

These are monitoring thresholds, distinct from the on-chain
`PERSISTENT_TTL_THRESHOLD`/`TEMPORARY_TTL_THRESHOLD` constants in
`docs/CONTRACT_ARCHIVAL_STRATEGY.md`, which trigger the contract's own
automatic extension. Monitoring should alert well before the on-chain
auto-extension logic is expected to run, so a failure in that logic (e.g.
an unfunded fee-payer account) is caught by a human, not silently missed.
