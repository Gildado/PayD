# Frontend Integration Guide — PayD

This guide covers the frontend architecture and how to integrate with PayD's Soroban contracts.

## 🛠 Prerequisites

- **Node.js** v18+
- **Freighter Wallet** browser extension
- **pnpm** or **npm**

## 📂 Project Structure

```
frontend/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── next.config.js
└── src/
    ├── app/                      # Next.js App Router pages
    │   ├── layout.tsx            # Root layout
    │   ├── page.tsx              # Home / dashboard
    │   ├── treasury/page.tsx     # Treasury dashboard
    │   ├── payroll/page.tsx      # Payroll streams
    │   ├── vesting/page.tsx      # Vesting schedules
    │   └── governance/page.tsx   # Governance proposals
    ├── components/               # Reusable UI components
    │   └── WalletButton.tsx      # Wallet connect button
    ├── hooks/                    # Custom React hooks
    │   ├── useTreasury.ts
    │   ├── usePayrollStream.ts
    │   ├── useVesting.ts
    │   └── useGovernance.ts
    ├── lib/                      # Utility libraries
    │   ├── network.ts            # Soroban network config
    │   └── wallet.ts             # Freighter utilities
    └── styles/
        └── globals.css           # Global styles + Tailwind
```

## 🚀 Getting Started

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

## 🔌 Soroban Integration Pattern

### 1. Network Setup
The `src/lib/network.ts` file contains the RPC endpoint and contract IDs. Update these after deployment.

### 2. Building a Contract Call

```typescript
import { SorobanRpc, TransactionBuilder, Networks } from '@stellar/stellar-sdk'

// Create server
const server = new SorobanRpc.Server(NETWORK.rpcUrl)

// Build transaction
const account = await server.getAccount(publicKey)
const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.TESTNET })
  .addOperation(/* contract call operation */)
  .setTimeout(30)
  .build()

// Simulate
const simulated = await server.simulateTransaction(tx)
```

### 3. Signing with Freighter

```typescript
import { signTransaction } from '@stellar/freighter-api'

const signedXDR = await signTransaction(tx.toXDR(), {
  networkPassphrase: Networks.TESTNET,
})
```

### 4. Submitting Transaction

```typescript
const result = await server.sendTransaction(signedTx)
// Poll for confirmation
const status = await server.getTransaction(result.hash)
```

## 🎨 Design System

### Color Palette
The project uses a custom Stellar-inspired dark theme:

| Token | Value | Usage |
|-------|-------|-------|
| `stellar-primary` | `#7B61FF` | Primary actions, links |
| `stellar-secondary` | `#00C2FF` | Secondary actions |
| `stellar-accent` | `#FF6B6B` | Alerts, destructive actions |
| `stellar-success` | `#2ED573` | Success states |
| `stellar-warning` | `#FFA502` | Warning states |
| `stellar-dark` | `#0D1117` | Background |
| `stellar-surface` | `#161B22` | Card backgrounds |
| `stellar-border` | `#30363D` | Borders |

### Component Conventions
- All components live in `src/components/`
- Use TypeScript for all files
- Prefer `'use client'` directive for interactive components
- Use `className` for Tailwind styles (no inline styles)

## 🪝 Custom Hooks

Each contract has a dedicated hook in `src/hooks/`:

| Hook | Contract | Purpose |
|------|----------|---------|
| `useTreasury()` | Treasury | Deposit, withdraw, manage signers |
| `usePayrollStream()` | Payroll | Create streams, claim, cancel |
| `useVesting()` | Vesting | Create schedules, claim, revoke |
| `useGovernance()` | Governance | Propose, vote, finalize, execute |

## 📋 Finding Issues

See `docs/ISSUES-FRONTEND.md` for all available tasks (FE-1 through FE-25).
