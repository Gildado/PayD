# Revenue Split Contract

The revenue split contract distributes incoming token payments to configured
recipients by basis points. The final recipient receives any rounding remainder
so the full input amount is distributed.

## Public Functions

| Function | Purpose |
| --- | --- |
| `init(admin, shares)` | Initializes the contract with an admin and recipient split. |
| `distribute(token, from, amount)` | Transfers `amount` of `token` from `from` to recipients according to the configured split. |
| `preview_distribution(amount)` | Returns the recipient amounts that would be paid for `amount`. |
| `update_recipients(new_shares)` | Replaces recipient split configuration. Admin only. |
| `set_admin(new_admin)` | Transfers admin control. Admin only. |
| `set_paused(paused)` | Pauses or unpauses distributions. Admin only. |
| `add_supported_asset(token)` | Adds a token contract address to the supported-asset allowlist. Admin only. |
| `remove_supported_asset(token)` | Removes a token contract address from the supported-asset allowlist. Admin only. |
| `get_supported_assets()` | Returns the configured supported token assets. |
| `is_asset_supported(token)` | Returns whether a token can currently be distributed. |
| `get_total_distributed(token)` | Returns cumulative distributed amount for a token. |
| `get_distribution_count()` | Returns the number of successful distributions. |
| `bump_ttl()` | Extends TTL for critical storage entries. Admin only. |

## Multi-Asset Support

The contract tracks distribution totals per token address and can distribute any
Soroban token contract. For backward compatibility, an empty supported-asset
allowlist means all token addresses are accepted. Once an admin adds one or more
assets with `add_supported_asset`, `distribute` rejects tokens that are not in
the allowlist with `UnsupportedAsset`.

Replay protection is ledger-wide, so only one distribution can execute per
ledger sequence even when different assets are used.
