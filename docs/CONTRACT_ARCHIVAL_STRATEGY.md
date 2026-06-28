# Soroban Contract Archival Strategy

This document defines how PayD contracts manage Soroban state archival, TTL extension, and restoration handling.

## Storage Audit (Persistent vs Temporary)

### `contracts/bulk_payment`

- `DataKey::Admin` -> **Persistent** (critical governance/auth state)
- `DataKey::BatchCount` -> **Persistent** (monotonic counter)
- `DataKey::Sequence` -> **Persistent** (replay protection)
- `DataKey::Batch(batch_id)` -> **Temporary** (historical execution records)

### `contracts/cross_asset_payment`

- `DataKey::Admin` -> **Persistent** (critical governance/auth state)
- `DataKey::PaymentCount` -> **Persistent** (monotonic counter)
- `DataKey::Payment(payment_id)` -> **Temporary** (historical payment records)

### `contracts/revenue_split`

- `DataKey::Admin` -> **Persistent** (critical governance/auth state)
- `DataKey::Recipients` -> **Persistent** (active payout config required for runtime behavior)

### `contracts/vesting_escrow`

- `DataKey::Config` -> **Persistent** (active vesting state, claim/clawback correctness)

### `contracts/hello_world`

- No contract state.

## TTL Extension Policy

Critical persistent keys are proactively bumped using contract-level `bump_ttl` functions and also on normal access paths.

Current policy constants:

- Persistent threshold: `20_000` ledgers
- Persistent extend-to: `120_000` ledgers
- Temporary threshold: `2_000` ledgers
- Temporary extend-to: `20_000` ledgers

Rationale:

- Persistent keys are expensive to lose and are needed for correctness/authorization.
- Temporary keys represent historical/audit data and can expire naturally to cap long-term rent costs.

## Restoration Handling for Expired Entries

Soroban entries that leave the live state can be restored externally with `RestoreFootprintOp`.
Contract-side behavior now distinguishes this case via explicit messages/errors:

- Critical missing persistent keys surface as "entry unavailable; restore and retry" errors.
- Temporary historical entries return not found semantics (or archived/not found errors), which callers should treat as expected archival behavior.

Operational restoration runbook:

1. Detect missing critical key via contract error.
2. Submit restore operation for affected ledger keys.
3. Re-run the original contract call.
4. Call `bump_ttl` to re-establish TTL headroom.

## Archival Cycle

Recommended operational cycle per organization:

- Weekly or bi-weekly: run admin `bump_ttl` calls on all production contracts.
- Monthly: review temporary-key retention requirements against compliance needs.
- Quarterly: archive historical event data off-chain (indexer/database) and allow older temporary keys to expire.

## Cost Expectations

Costs vary by network conditions, but the pattern is stable:

- Frequent writes to persistent keys increase rent footprint but reduce restoration risk.
- Temporary historical keys lower long-term rent, shifting old history access to off-chain indexers.
- `extend_ttl` operations add compute/storage-touch overhead and should be batched during normal admin maintenance windows.

Expected budget profile:

- Low, recurring maintenance cost for `bump_ttl`.
- Higher, infrequent restoration cost if critical keys are allowed to archive.

Keeping the maintenance cadence above is typically cheaper than emergency restoration of core governance/config keys.
