# Reference examples (documentation only)

These files are **reference material**. They are deliberately kept outside
`frontend/src` so they are:

- excluded from the TypeScript app project (`tsconfig.app.json` includes only
  `src`),
- not part of Vite's build input graph, and
- not importable from any app route (`@/*` resolves to `src/*`).

| File | What it demonstrates |
| --- | --- |
| `BulkPayrollUpload.example.tsx` | Integrating `FeeEstimationConfirmModal` into bulk payroll upload |
| `contracts.example.tsx` | Fetching contract addresses through `contractService` |
| `TransactionNotificationExample.tsx` | Triggering transaction notifications from any component |

Imports inside these examples point back into `../../src` for reference only;
copy the relevant snippet into your own component to use it.
