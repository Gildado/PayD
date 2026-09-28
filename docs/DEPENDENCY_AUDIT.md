# OpenZeppelin `stellar-contracts` Dependency Audit

Part of the mainnet launch readiness initiative (#1620). Covers the three
git-tag-pinned dependencies in the workspace root `Cargo.toml`:

```toml
[workspace.dependencies.stellar-access]
git = "https://github.com/OpenZeppelin/stellar-contracts"
tag = "v0.6.0"

[workspace.dependencies.stellar-macros]
git = "https://github.com/OpenZeppelin/stellar-contracts"
tag = "v0.6.0"

[workspace.dependencies.stellar-tokens]
git = "https://github.com/OpenZeppelin/stellar-contracts"
tag = "v0.6.0"
```

## Finding

All three are pinned to `v0.6.0` (a real, deliberate tag — not a floating
branch or commit SHA, which is the right practice for a dependency this
security-sensitive). However, that tag is **three stable releases behind**
upstream as of this audit:

```
v0.6.0  ← currently pinned
v0.7.0
v0.7.1
v0.7.2  ← latest stable
v0.8.0-rc.1 / -rc.2 / -rc.3  (pre-release, not recommended for mainnet)
```

(Checked via `git ls-remote --tags https://github.com/OpenZeppelin/stellar-contracts.git`.)

## Recommendation

Bump the pin to `v0.7.2` (the latest stable, non-release-candidate tag) —
**not** as part of this audit PR, deliberately:

- These packages back `stellar-access` (role/authorization primitives) and
  `stellar-tokens` (token standard implementations) used across contracts
  that hold real organization funds on mainnet. A dependency bump three
  minor versions up needs its own PR with a full `cargo test --workspace`
  run and a diff review of what changed in `stellar-access`/`stellar-macros`/
  `stellar-tokens` between v0.6.0 and v0.7.2, not a version-string edit
  bundled into an unrelated audit/monitoring PR.
- Before merging that bump PR: read OpenZeppelin's changelog/release notes
  for v0.7.0, v0.7.1, and v0.7.2 for any breaking API or behavioral change
  to the specific primitives PayD's contracts actually use (role-based
  access control, pausable/circuit-breaker patterns, token transfer
  hooks), and re-run the full contract test suite plus
  `scripts/verify_contract.sh` against a fresh testnet deploy before
  considering it for mainnet.

## Action items

- [ ] Open a dedicated PR bumping `stellar-access`/`stellar-macros`/
      `stellar-tokens` to `v0.7.2`.
- [ ] Diff-review OpenZeppelin's v0.6.0 → v0.7.2 changes for the specific
      primitives in use.
- [ ] Full `cargo test --workspace` + `scripts/verify_contract.sh` against
      a testnet redeploy on the bump PR before merging.
- [ ] Re-audit against upstream's latest tag again shortly before the
      actual mainnet cutover date, since more releases may land between
      now and then.
