# Generated API types for the frontend

The frontend's request and response types for backend endpoints are generated from the backend's OpenAPI
document, `backend/openapi.json`, so they cannot silently drift from the server (issue #1808).

## Files

| Path                                             | Role                                                                 |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| `backend/openapi.json`                           | Source of truth. Edit this when an endpoint's contract changes.      |
| `frontend/scripts/generate-api-types.mjs`        | Generator. Uses [`openapi-typescript`](https://openapi-ts.dev/).     |
| `frontend/src/api/generated/openapi.ts`          | Generated output. **Do not edit by hand.** Committed to git.         |
| `frontend/src/services/transactionHistoryApi.ts` | Pilot consumer: `fetchAuditRecords` uses the generated response type. |

## Commands

Run from `frontend/`:

```bash
# Regenerate after changing backend/openapi.json
npm run api:types

# Verify the committed file matches the spec (what CI runs)
npm run api:types:check
```

`api:types:check` exits with status 1 when `src/api/generated/openapi.ts` is out of date, and prints the
command to fix it. The `build.yml` frontend job runs this check on every push and pull request.

## Using the types

```ts
import type { components, paths } from '../api/generated/openapi';

type AuditListResponse = components['schemas']['AuditListResponse'];

const response = await axiosInstance.get<AuditListResponse>('/api/v1/audit', { params });
```

Use `components['schemas'][...]` for shared payload shapes and `paths[...]` for per-operation parameters
and responses.

## Changing an API

1. Update the route's JSDoc or edit `backend/openapi.json` so it describes the new contract.
2. Run `npm run api:types` in `frontend/`.
3. Commit `backend/openapi.json` and `frontend/src/api/generated/openapi.ts` together.
4. Update consumers. TypeScript reports any call site that no longer matches.

Prettier and ESLint ignore `src/api/generated/`, so the generated formatting is kept as produced.

## Current scope

The pilot migrates one service. The other `frontend/src/services/*Api.ts` files still hand-write their types
and can be moved over one at a time. Each endpoint needs component schemas in `backend/openapi.json` for its
types to be useful; operations without them produce empty response types.
