# Bulk Payment Crash Recovery

This document describes how `BulkPaymentService` and `BulkPaymentBatchWorkflow`
make a batch of Stellar payments safe to resume after a process crash or a lost
submit response (issue #1797).

## Rule

**Never rebuild a replacement transaction. Resume with the persisted
`batchId`.**

A replacement transaction would use a new sequence number or a different body
and could pay the same recipients twice. Recovery always uses the signed
envelope, hash, and source sequence that were persisted before the original
submission.

## Durable data model

Migration `063_bulk_payment_crash_recovery.sql` adds:

- `bulk_payment_batches.idempotency_key` — caller-supplied key, unique per
  organization. Replaying the same key and organization returns the same batch.
- `bulk_payment_batches.request_fingerprint` — SHA-256 of the source account,
  asset, and payment items. Reusing a key with a different payload is rejected.
- `bulk_payment_batches.resume_count` / `last_resumed_at` — resume audit trail.
- `bulk_payment_batches.status` — includes `interrupted`.
- `bulk_payment_envelopes` — one row per chunk of at most 100 operations, with
  `inner_xdr`, `inner_hash`, `source_sequence`, optional `fee_bump_xdr` /
  `fee_bump_hash`, `tx_hash`, `status`, `attempts`, and error/timestamp fields.
  `(batch_id, envelope_index)` is unique.
- `bulk_payment_items.envelope_id` / `updated_at` — links each payment to its
  envelope and records when its state last changed.

All signed envelopes and their per-payment state are written **before** the
first submission. An envelope is claimed with
`WHERE status = 'pending' AND inner_xdr IS NULL RETURNING *`, so only one worker
can own a given envelope; another worker reads the already-stored XDR instead.

## State machine

### Batch

| State | Meaning | Next states |
|---|---|---|
| `pending` | Record created; no submission started. | `processing` |
| `processing` | Envelopes claimed and being submitted. | `completed`, `partial`, `failed`, `interrupted` |
| `interrupted` | A submit outcome is unknown (timeout, 5xx, connection loss, process kill). Remaining envelopes are untouched. | `processing` (resume) |
| `completed` | All items were paid. Terminal. | — |
| `partial` | Some envelopes definitively failed. Terminal. | — |
| `failed` | No envelope succeeded. Terminal. | — |

### Envelope

| State | Meaning | Next states |
|---|---|---|
| `pending` | Row reserved, no signed XDR yet. | `submitted` |
| `submitted` | Signed XDR/hash persisted; submit attempted or in flight. This is the in-flight state. | `completed`, `failed` |
| `completed` | A ledger receipt or successful submit was observed. Terminal. | — |
| `failed` | A definite Horizon rejection was observed. Terminal. | — |

### Item

`pending` → `submitted` (before submit) → `completed` / `failed`. Items left in
`submitted` after a crash are reconciled from their envelope's on-chain
receipt on resume.

## Idempotency and receipt checks

- `submitBatch(sourceKeypair, items, { organizationId, idempotencyKey })` creates
  the batch once. A replay with the same key and payload returns the same
  `batchId` without creating new rows or payments; a different payload fails.
- Before submitting a stored envelope, the service calls Horizon
  `getTransaction(hash)` using `tx_hash`, `fee_bump_hash`, and `inner_hash`. A
  404 means "not indexed yet" and allows submission. Any found receipt skips
  submission entirely, so a lost response can never cause a second payment.
- The exact stored XDR is deserialized and submitted. A fee bump, when needed,
  is itself persisted (`fee_bump_xdr` / `fee_bump_hash`) before being submitted.
- An ambiguous/infrastructure error leaves the envelope `submitted`, marks the
  batch `interrupted`, and stops the loop. Remaining envelopes are not marked
  failed. Definite Horizon rejections keep the previous fail-fast-or-continue
  behavior and yield `partial` / `failed`.

## Operator recovery

1. Identify the affected batch:

   ```sql
   SELECT batch_id, status, total_items, successful_items, failed_items,
          resume_count, last_resumed_at
   FROM bulk_payment_batches
   WHERE status = 'interrupted'
   ORDER BY created_at;
   ```

2. Inspect in-flight envelopes and their stored hashes:

   ```sql
   SELECT envelope_index, status, inner_hash, fee_bump_hash, tx_hash, attempts, error_message
   FROM bulk_payment_envelopes
   WHERE batch_id = '<batch-id>' AND status = 'submitted'
   ORDER BY envelope_index;
   ```

3. Check the hashes on Horizon/explorer. Pending receipts usually appear within
   a few ledgers. Do not create a replacement payment while a receipt is
   pending.

4. Resume with the same identifier. No original item list is needed:

   ```ts
   await BulkPaymentService.submitBatch(sourceKeypair, [], {
     organizationId,
     batchId: '<batch-id>',
   });

   // or through the workflow:
   await workflow.resume(context, { sourceSecret, batchId: '<batch-id>' });
   ```

   The service increments `resume_count`, re-checks receipts by stored hash,
   finishes only unresolved envelopes, and finalizes counters from persisted
   item state.

5. Confirm `bulk_payment_batches.status` is `completed` (or `partial` for
   definite failures), `successful_items + failed_items = total_items`, and no
   item is still `submitted`.

If an envelope has no `inner_xdr` (for example, a crash during the claim phase
before signing completed), automated resume stops with an explicit error. An
operator must reconcile that envelope using the original request; the service
will not fabricate a new transaction.
