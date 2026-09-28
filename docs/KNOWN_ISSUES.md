# Known Issues

This page tracks active limitations and expected behavior that contributors and users may encounter.

## Authentication and sessions

- OAuth callback flows can return only an access token depending on provider configuration, which means session extension may require signing in again.
- If a refresh token is unavailable or invalid, users are redirected to login when the session expires.

## Local development

- Missing `VITE_BACKEND_URL` can cause auth and API requests to fail against the wrong origin.
- If Docker services are not running, backend-dependent pages will show API errors.

## Wallet and network integration

- Network mismatches (testnet vs mainnet) can prevent trustline checks and transaction previews.
- Horizon rate limits may temporarily affect wallet reads during heavy local testing.
