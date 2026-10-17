# Trustline, freeze appeal, and contributor reward workflows

These deterministic workflows implement issues #1260–#1263. They wrap the existing
trustline/freeze services and the XLM reward tiers published on `ContributorRewards.tsx`.
They do not use an LLM to approve an appeal, attest contribution evidence, or sign a payment.

This checkout has no Mastra runtime, tool registry, or agent-specific authorization
package. The entry points in `backend/src/workflows/` follow the existing service
workflow pattern and reuse Winston and `withSpan` from OpenTelemetry. A future
Mastra tool can call these entry points with server-provided `WorkflowContext`;
context must never be accepted from model arguments. No additional agent runtime
or unrelated infrastructure is introduced here.

## Setup and tests

Install backend dependencies with `npm ci --legacy-peer-deps`. Apply migration
`061_create_orchestration_records.sql` using the deployment's migration procedure.
It adds one table with organization-scoped business references, timestamps, and
conditional status transitions. Existing migrations are unchanged; a matching
rollback is provided. Reconcile submitted payments before considering a rollback.

From `backend/`:

```bash
npx tsx src/db/migrate.ts --dry-run
npm run test:workflows
# Also run real PostgreSQL persistence/migration tests against a local test database:
WORKFLOW_TEST_DATABASE_URL=postgres://postgres:password@localhost:5432/payd_test npm run test:workflows
```

Integration tests create and remove an isolated schema, apply the new migration
twice, exercise unique references and concurrent claims, and run its rollback twice.
The `Orchestration Workflow Tests` GitHub Actions job supplies PostgreSQL 15 and
runs this suite. The dedicated Jest config supports Jest 29 mocks without changing
the legacy backend suite's ESM configuration.

From `frontend/`, run:

```bash
npm test -- src/components/__tests__/ContributorRewardStatus.test.tsx src/__tests__/ContributorRewards.test.tsx
npm run build
```

## API and authorization

All paths below are relative to `/api/v1/workflows`. Send a valid bearer JWT and
JSON bodies. Organization and actor identity come exclusively from the verified
JWT. Request schemas reject unknown fields, including client-supplied organization
or role values. Database lookups and status transitions bind the organization.
Employee trustline/appeal access additionally requires a matching wallet in that
organization; employer access is restricted to employees of their organization.

| Method and path                   | Role                        | Purpose                                                       |
| --------------------------------- | --------------------------- | ------------------------------------------------------------- |
| `POST /trustline/setup`           | Employee or employer        | Refresh trustline, prepare unsigned changeTrust, mark pending |
| `POST /freeze/appeals`            | Employee or employer        | Stage an appeal against the current audited freeze            |
| `GET /freeze/appeals/:id`         | Scoped employee or employer | Read appeal status and review evidence                        |
| `POST /freeze/appeals/:id/review` | Employer                    | Reject, approve/unfreeze, or reconcile an executing appeal    |
| `POST /rewards/eligibility`       | Employer                    | Evaluate attested criteria and stage an XLM payout            |
| `GET /rewards`                    | Employer                    | List the organization's latest 100 reward records             |
| `POST /rewards/:id/prepare`       | Employer                    | Prepare and persist an unsigned payment for wallet signing    |
| `POST /rewards/:id/distribute`    | Employer                    | Submit the exact signed payment and confirm its ledger result |
| `POST /email-delivery/escalate`   | Employee or employer        | Escalate persistent email delivery failures to alternate contact |
| `POST /social-auth/link`          | Scoped user or employer     | Orchestrate social identity linking to existing account        |
| `POST /tenant-config/rollout`     | Employer                    | Staged, verifiable configuration rollout across environments   |
| `POST /search-index/rebuild`      | Employer                    | Trigger scheduled and on-demand search index rebuild           |

Execution responses contain `executionId`, `status`, `steps` (attempt count,
duration, success/failure), and either `output` or a safe `error`. A completed
execution can have an ineligible contribution or an on-chain failed payment as
its business result: always inspect `output.status` as well as HTTP status.

## Trustline setup (#1261)

Example body:

```json
{ "employeeId": 12, "assetCode": "USDC" }
```

The issuer defaults to the supported asset registry; a valid explicit
`assetIssuer` is also accepted. The workflow resolves the scoped employee wallet,
refreshes the trustline through `TrustlineService`, and stops if established.
Otherwise it builds an unsigned transaction and marks the record pending. Output
has `status: "awaiting_signature"` and `unsignedXdr`. The employee signs/submits
through their existing wallet flow, then calls setup again to refresh and observe
`established`. XLM returns established without a changeTrust transaction. An
unfunded/missing account cannot complete transaction preparation. No employee
private key is requested and unsigned transactions are never submitted here.

## Freeze appeal/review (#1260)

Submit an appeal:

```json
{
  "employeeId": 12,
  "assetCode": "USDC",
  "assetIssuer": "<valid issuer public key>",
  "reason": "Please review the attached compliance evidence."
}
```

The wallet must have an active freeze and a matching freeze audit entry. The
workflow uses employee, asset, issuer, and freeze-log identity as its unique
reference: retries return the same appeal instead of opening duplicates.

Review body: `{"decision":"reject","reason":"Evidence remains insufficient."}`
or `{"decision":"approve","reason":"Compliance review passed.","issuerSecret":"<issuer signing key>"}`.
Approval verifies current employee scope, trustline presence, freeze-log freshness,
and issuer-key identity before atomically claiming the review. Only the employer
review endpoint accepts an issuer secret, matching the existing freeze service's
signing API; it is neither persisted nor included in workflow logs or responses.
Existing deployment controls for issuer key custody still apply.

States: `pending_review → rejected`, or `pending_review → executing → unfrozen`.
The existing freeze service builds/signs internally, so `execute-unfreeze` runs
once, with no automatic transaction retry. A timeout, post-submit audit failure,
or persistence failure leaves `executing` durable. A repeated review reconciles
on-chain state and a later successful unfreeze audit entry, and **never calls
toggleAccountFreeze again**. If both sources cannot establish a resolution,
the response sets `reconciliationRequired: true`; an operator must investigate
the existing freeze audit/ledger rather than blindly submit a second transaction.
Neither resubmitting a rejection nor an approval reopens a completed appeal.

## Reward eligibility (#1262)

Example body:

```json
{
  "issueNumber": 123,
  "pullRequestNumber": 456,
  "contributorAddress": "<funded Stellar public key>",
  "tier": "Minor",
  "rewardEligible": true,
  "merged": true,
  "maintainerApproved": true,
  "testsPassed": true
}
```

The authorized employer attests these facts after reviewing the upstream issue
and PR. This integration does not independently query GitHub or grant eligibility
based on a contributor's self-reported inputs. All four criteria must pass; an
ineligible result lists unmet criteria and stages no payment. The recipient must
have a valid, funded account. Amounts are determined by the published policy:
Minor = 100 XLM, Major = 500 XLM, Critical = 2000 XLM. This version stages these
XLM rewards only; it does not invent a USDC conversion policy. Native XLM needs
no trustline. The approved criteria, reviewer identity, and amount are persisted.

One reward per upstream issue per organization is enforced in PostgreSQL.
Repeated eligibility calls return that record; a changed recipient, tier, or PR
conflicts rather than overwriting already approved payout evidence.

## Reward execution and confirmation (#1263)

1. Call `POST /rewards/:id/prepare` with `{}`. The payer is the organization's
   configured Stellar public key. It must differ from the recipient. The workflow
   prepares a native payment and persists its unsigned envelope with a finite
   timeout and reward-identifying memo before returning it.
2. The payer's wallet signs `output.data.unsignedXdr` on the backend's configured
   Stellar network. No payer secret is sent to the workflow.
3. Call `POST /rewards/:id/distribute` with `{"signedXdr":"<wallet-signed envelope>"}`.
   The transaction body/hash must match the prepared transaction exactly and
   contain signatures. Horizon performs signature/threshold authorization.
4. The workflow atomically moves `awaiting_signature → submitted`, persisting the
   exact signed envelope and hash **before** any submit. It checks for an existing
   ledger result, submits when necessary, polls confirmation, and records
   `confirmed` or `failed` based on Horizon's `successful` field.

If a response is lost or confirmation remains pending, repeat the distribute
call with `{}` and the same reward ID. Recovery uses the stored envelope and
sequence. It never constructs a replacement payment. Concurrent callers may
resubmit the same envelope, which cannot execute a second payment. Confirmed or
failed payouts are terminal. Expired envelopes or sequence conflicts require
operator reconciliation; this workflow does not automatically create a new
payment that might double-pay a previously submitted reward. Signed envelopes are
internal recovery data and are removed from list and execution responses.

The rewards page shows staged/executing/confirmed status and transaction hashes
with a refresh action, loading/error announcements, and wrapping long hashes.
It does not add an unrelated payout administration UI.

## Email deliverability failure escalation (#1272)

Example body:

```json
{
  "employeeId": 20,
  "failureThreshold": 3,
  "forceEscalate": false
}
```

Orchestrates automated detection and escalation when persistent email deliverability failures occur:
1. `check-delivery-status`: Resolves employee in scope, inspects bounce logs and invalid email registries via `EmailDeliveryTrackingService`. If failure count is below threshold, returns `status: "healthy"`.
2. `evaluate-alternate-channels`: Evaluates alternate contact methods (e.g. employee phone for SMS fallback, webhook, or administrator alert).
3. `escalate-failure`: Flags the email address as invalid in database and invalid email records, and dispatches an escalation notification via the alternate channel with retry backoff.

## Social auth account linking (#1273)

Example body:

```json
{
  "provider": "github",
  "providerId": "gh_123456"
}
```

Coordinates linking a new OAuth social identity (Google or GitHub) to an existing authenticated user account:
1. `validate-social-payload`: Validates supported provider (`google` or `github`) and non-empty provider ID.
2. `verify-target-availability`: Checks if the identity is already claimed. Rejects collisions with `CONFLICT` (409) if linked to a different account; returns idempotently if already linked to caller.
3. `verify-account-ownership`: Verifies caller's active user account in the database.
4. `link-social-identity`: Atomically inserts row into `social_identities` table.

## Tenant configuration rollout (#1275)

Example body:

```json
{
  "configKey": "payment_settings",
  "configValue": { "default_currency": "EURC", "auto_approve_threshold": 500 },
  "description": "Adjust default currency and auto-approval threshold",
  "dryRun": false
}
```

Staged, verifiable rollout of tenant configurations:
1. `validate-config-schema`: Verifies configuration key and structured object payload.
2. `stage-config-rollout`: Loads previous configuration state for rollback baseline. If `dryRun: true`, completes without modifying persistent state.
3. `apply-tenant-config`: Updates `tenant_configurations` and invalidates Redis cache through `TenantConfigService`.
4. `verify-config-rollout`: Reads back configuration from storage and cache to verify consistency.

## Search index rebuild (#1277)

Example body:

```json
{
  "targetEntity": "employees"
}
```

Orchestrated and observable search index rebuild:
1. `check-index-status`: Inspects active employee count in the authenticated organization.
2. `rebuild-search-index`: Recomputes English `search_vector` tsvector across employee names, email, department, position, and wallet addresses.
3. `verify-index-integrity`: Runs a probe query via `SearchService` to verify that full-text ranking and pagination metadata are healthy.

## Retry policy and observability

Each safe step gets at most three attempts, with 100 ms and 200 ms backoff for
HTTP 429/5xx, selected connection failures, PostgreSQL transient failures, and
pending ledger confirmation. Validation, missing resources, rejected reviews,
and authorization failures do not retry. Read and idempotent upsert retries do
not rerun preceding steps. Conditional claims and state transitions do not retry
automatically: a caller reloads persisted state after an uncertain database result.

Winston emits workflow start/completion/failure plus step, execution ID,
organization, actor, attempt, and retry events. Each execution and step has an
OpenTelemetry span using the existing tracing setup. Responses provide step
durations and attempts. Request bodies, issuer secrets, appeal reasons, and
signed envelopes are excluded from workflow log metadata.
