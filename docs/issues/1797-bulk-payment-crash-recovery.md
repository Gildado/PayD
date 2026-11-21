# #1797: bulkPaymentService: persist batch progress so a crash mid-batch can resume safely

**Category:** [BACKEND]
**Difficulty:** HIGH
**Tags:** `bulk-payments, reliability, database, workflows`

## Description

`BulkPaymentService` built and signed Stellar transactions in memory and only
recorded item status after submission, so a crash mid-batch could leave payments
in an unknown state with no way to resume without rebuilding (and potentially
double-paying) them. Persist a durable batch identity, an idempotency key and
fingerprint, and one signed envelope row per chunk before any submission. Make
submission idempotent by claiming envelopes conditionally and checking Horizon
receipts by stored hash before resubmitting the exact stored XDR. Add an
`interrupted` batch state for ambiguous failures, a workflow resume path, unit
tests for crash recovery, and operator documentation.

## Acceptance Criteria

- [ ] Persist per-payment state and signed envelopes before submission.
- [ ] Make batch creation and submission idempotent; reject a reused key with a different payload.
- [ ] Allow safe resume by `batchId` without rebuilding transactions from caller items.
- [ ] Mark ambiguous failures `interrupted` and never deterministically fail untouched envelopes.
- [ ] Add migration `063`, matching rollback, and updated `DB_SCHEMA.md`.
- [ ] Add crash/resume unit tests with an in-memory database and mocked Stellar service.
- [ ] Document the state machine and operator recovery procedure.
