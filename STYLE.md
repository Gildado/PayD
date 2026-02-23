# Style Guide — PayD

## Rust (Smart Contracts)

### Formatting
- Use `rustfmt` with default settings: `cargo fmt`
- Max line width: 100 characters
- Use 4-space indentation (Rust default)

### Naming Conventions
- **Functions:** `snake_case` — `create_withdrawal`, `get_threshold`
- **Structs:** `PascalCase` — `WithdrawalRequest`, `PayrollStream`
- **Enums:** `PascalCase` — `StreamStatus`, `VoteChoice`
- **Constants:** `SCREAMING_SNAKE_CASE` — `MAX_SIGNERS`
- **Modules:** `snake_case` — `storage`, `types`, `errors`

### Code Organization
Each contract follows this file structure:
```
contract_name/src/
├── lib.rs       # Public contract functions (this is the API surface)
├── types.rs     # Data structures (structs, enums)
├── storage.rs   # Storage keys + get/set helpers
├── errors.rs    # Error enum
└── test.rs      # Unit tests
```

### Error Handling
- Always return `Result<T, ContractError>` from public functions
- Use descriptive error variants
- Number error variants sequentially
- Add doc comments to each error explaining when it triggers

### Testing
- Every public function must have at least one test
- Test happy path AND error cases
- Use `#[should_panic]` for expected failures
- Use `env.mock_all_auths()` in tests

## TypeScript (Frontend & SDK)

### Formatting
- Use Prettier with default settings
- Max line width: 100 characters
- Use 2-space indentation
- Semicolons: yes
- Single quotes: yes
- Trailing commas: all

### Naming Conventions
- **Components:** `PascalCase` — `WalletButton`, `StreamCard`
- **Files (components):** `PascalCase.tsx` — `WalletButton.tsx`
- **Files (hooks):** `camelCase.ts` — `useTreasury.ts`
- **Files (utils):** `camelCase.ts` — `network.ts`
- **Functions:** `camelCase` — `connectWallet`, `buildTransaction`
- **Constants:** `SCREAMING_SNAKE_CASE` — `NETWORK`, `CONTRACTS`
- **Types/Interfaces:** `PascalCase` — `StreamStatus`, `Proposal`

### React Conventions
- Use functional components only
- Use `'use client'` directive for interactive components
- Prefer hooks over class components
- Keep components focused and small (< 150 lines)
- Extract logic into custom hooks

### CSS
- Use Tailwind utility classes
- Avoid inline styles
- Use design tokens from `tailwind.config.ts`
- Dark mode first (via `dark` class on `<html>`)
