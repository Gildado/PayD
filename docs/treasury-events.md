# Treasury Event Schemas

This document outlines all events emitted by the PayD Treasury Contract for off-chain indexing.

## Event Topics

All treasury events use a 5-character symbol topic:
- `TreasuryInitialized`
- `TreasuryDeposit`
- `WithdrawalCreated`
- `WithdrawalApproved`
- `WithdrawalExecuted`
- `WithdrawalCancelled`
- `SignerAdded`
- `SignerRemoved`
- `ThresholdUpdated`

## Event Schemas

### TreasuryInitialized

Emitted when the treasury is initialized with an admin and initial signers.

**Topic:** `TreasuryInitialized`

**Data:**
```rust
struct TreasuryInitializedEvent {
    admin: Address,    // The admin address that was set
}
```

---

### TreasuryDeposit

Emitted when tokens are deposited into the treasury.

**Topic:** `TreasuryDeposit`

**Data:**
```rust
struct TreasuryDepositEvent {
    depositor: Address,    // Address of the account depositing tokens
    token: Address,       // Token address being deposited
    amount: i128,         // Amount of tokens deposited
}
```

---

### WithdrawalCreated

Emitted when a new withdrawal request is created by a signer.

**Topic:** `WithdrawalCreated`

**Data:**
```rust
struct WithdrawalCreatedEvent {
    proposal_id: u32,     // Unique proposal identifier
    proposer: Address,   // Address of the signer who created the request
    token: Address,      // Token address to withdraw
    recipient: Address,  // Address that will receive the funds
    amount: i128,        // Amount of tokens requested
    memo: Symbol,        // Short description/reference
}
```

---

### WithdrawalApproved

Emitted when a signer approves a withdrawal request.

**Topic:** `WithdrawalApproved`

**Data:**
```rust
struct WithdrawalApprovedEvent {
    proposal_id: u32,        // Unique proposal identifier
    signer: Address,         // Address of the signer who approved
    approval_count: u32,     // Current number of approvals
    threshold: u32,          // Required threshold for execution
}
```

---

### WithdrawalExecuted

Emitted when an approved withdrawal is executed and funds are transferred.

**Topic:** `WithdrawalExecuted`

**Data:**
```rust
struct WithdrawalExecutedEvent {
    proposal_id: u32,     // Unique proposal identifier
    recipient: Address,   // Address that received the funds
    token: Address,       // Token address that was transferred
    amount: i128,         // Amount of tokens transferred
}
```

---

### WithdrawalCancelled

Emitted when a pending withdrawal request is cancelled.

**Topic:** `WithdrawalCancelled`

**Data:**
```rust
struct WithdrawalCancelledEvent {
    proposal_id: u32,     // Unique proposal identifier
    caller: Address,      // Address that cancelled the request (proposer or admin)
}
```

---

### SignerAdded

Emitted when a new signer is added to the treasury.

**Topic:** `SignerAdded`

**Data:**
```rust
struct SignerAddedEvent {
    new_signer: Address,  // Address of the new signer
}
```

---

### SignerRemoved

Emitted when a signer is removed from the treasury.

**Topic:** `SignerRemoved`

**Data:**
```rust
struct SignerRemovedEvent {
    removed_signer: Address,  // Address of the removed signer
}
```

---

### ThresholdUpdated

Emitted when the approval threshold is updated.

**Topic:** `ThresholdUpdated`

**Data:**
```rust
struct ThresholdUpdatedEvent {
    old_threshold: u32,   // Previous threshold value
    new_threshold: u32,   // New threshold value
}
```

## Off-Chain Indexing

These events are designed to support efficient off-chain indexing:

1. **Consistent naming** - All events follow a clear naming pattern: `{Action}{Object}`
2. **Structured data** - Each event includes all relevant context for indexing
3. **Transaction linking** - `proposal_id` can be used to link related events (created → approved → executed)
4. **State tracking** - Events include sufficient data to reconstruct contract state
