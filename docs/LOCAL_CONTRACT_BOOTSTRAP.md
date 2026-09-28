# Local Contract Bootstrap

This helper automates the local Soroban workflow used when you want to build,
deploy, and seed the workspace contracts from one place.

## Script

Run the bootstrapper from the repo root:

```bash
npm run contracts:bootstrap:dry-run
```

The default run plan:

- runs `cargo test -p <crate> --lib --tests` for the selected contracts
- builds each contract to `target/wasm32-unknown-unknown/release/<crate>.wasm`
- deploys the WASM with `stellar contract deploy`
- initializes contracts that have a simple built-in bootstrap recipe

## Default Contracts

The script targets the workspace Soroban contracts:

- `bulk_payment`
- `cross_asset_payment`
- `asset_path_payment`
- `revenue_split`
- `vesting_escrow`
- `smart_wallet`

Only the first three have automatic init calls today because their bootstrap
state is a single admin address. The other contracts are still deployed, but
their initial state is intentionally left to custom setup because they need
structured arguments:

- `revenue_split` needs a `Vec<RecipientShare>`
- `vesting_escrow` needs token, timing, and funding inputs
- `smart_wallet` needs signers and a threshold

## Common Options

- `--dry-run` prints the exact commands without executing them.
- `--skip-tests` skips the Rust contract test step.
- `--skip-build` reuses an existing wasm artifact path.
- `--contract` can be repeated or comma-separated to target a subset.
- `--source-account` sets the deploy signer.
- `--admin-account` overrides the address passed into init calls.

## Example

```bash
npm run contracts:bootstrap -- \
  --contract bulk_payment,cross_asset_payment,asset_path_payment \
  --source-account psalmuel
```

If your local Stellar profile uses a different identity, pass that identity or
its public key with `--source-account`.
