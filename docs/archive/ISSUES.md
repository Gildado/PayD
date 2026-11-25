# PayD Project Issues Board

This board tracks the breakdown of 100 issues for the PayD platform across Contract, Backend, and Frontend development.

## 📊 Summary

- **Total Issues**: 100
- **Contract**: 33
- **Backend**: 33
- **Frontend**: 34

---

## ⛓ [CONTRACT] Stellar / Smart Contract

_Focuses on asset issuance, trustlines, payment batching, and Soroban logic._

| ID   | Issue Title                                                                               | Difficulty | Status  |
| :--- | :---------------------------------------------------------------------------------------- | :--------: | :-----: |
| #001 | [Issue ORGUSD Custom Asset on Stellar Testnet](../issues/001-issue-orgusd-asset.md)     |   ● HARD   | ✅ DONE |
| #002 | [Implement Trustline Acceptance Flow](../issues/002-trustline-flow.md)                  |  ● MEDIUM  | ✅ DONE |
| #003 | [Build Bulk Payment Transaction Batching](../issues/003-bulk-payment-batching.md)       |   ● HARD   | ✅ DONE |
| #004 | [Set Up Horizon Client & Config](../issues/004-horizon-client-setup.md)                 |   ● EASY   | ⏳ TODO |
| #005 | [Integrate Anchor SEP-24 Protocol](../issues/005-sep-24-integration.md)                 |   ● HARD   | ⏳ TODO |
| #006 | [Implement Stellar Wallet Kit Integration](../issues/006-wallet-kit-integration.md)     |  ● MEDIUM  | ⏳ TODO |
| #007 | [Build On-Chain Tx Verification & Logging](../issues/007-tx-verification-logging.md)    |  ● MEDIUM  | ⏳ TODO |
| #008 | [Implement Account Balance Preflight Checks](../issues/008-balance-preflight-checks.md) |   ● EASY   | ✅ DONE |
| #009 | [Design Soroban Smart Contract](../issues/009-soroban-escrow-contract.md)               |   ● HARD   | ✅ DONE |
| #010 | [Write Stellar Tx Signing Unit Tests](../issues/010-stellar-signing-tests.md)           |  ● MEDIUM  | ✅ DONE |
| #031 | [Multi-Sig for Issuer Account](../issues/031-multi-sig-issuer.md)                       |   ● HARD   | ⏳ TODO |
| #032 | [Clawback Support for ORGUSD](../issues/032-clawback-support.md)                        |  ● MEDIUM  | ⏳ TODO |
| #033 | [Revenue Split Logic via Soroban](../issues/033-soroban-revenue-split.md)               |   ● HARD   | ⏳ TODO |
| #034 | [Asset Metadata SEP-1 Implementation](../issues/034-sep-1-metadata.md)                  |   ● EASY   | ⏳ TODO |
| #035 | [Transaction Throttling Mechanism](../issues/035-tx-throttling.md)                      |  ● MEDIUM  | ⏳ TODO |
| #036 | [Support for Multiple Stablecoins](../issues/036-multi-stablecoin-support.md)           |  ● MEDIUM  | ⏳ TODO |
| #037 | [Emergency Freeze Logic](../issues/037-emergency-freeze.md)                             |  ● MEDIUM  | ⏳ TODO |
| #038 | [Fee Estimation Service](../issues/038-fee-estimation.md)                               |   ● EASY   | ⏳ TODO |
| #039 | [SDS API Integration](../issues/039-sds-integration.md)                                 |   ● HARD   | ⏳ TODO |
| #040 | [Claimable Balances for Unregistered Users](../issues/040-claimable-balances.md)        |  ● MEDIUM  | ⏳ TODO |
| #041 | [Transaction Simulation for Validation](../issues/041-tx-simulation.md)                 |  ● MEDIUM  | ⏳ TODO |
| #042 | [Ledger Observer for Real-time Events](../issues/042-ledger-observer.md)                |   ● HARD   | ⏳ TODO |
| #043 | [SEP-31 Cross-Asset Payments](../issues/043-sep-31-payments.md)                         |   ● HARD   | ✅ DONE |
| #086 | [Implement Contract State Archival Strategy](../issues/086-archival-strategy.md)        |   ● HARD   | ⏳ TODO |
| #087 | [Optimize Gas Fees for Bulk Execution](../issues/087-gas-optimization.md)               |  ● MEDIUM  | ⏳ TODO |
| #088 | [Implement Account-Level Transaction Limits](../issues/088-tx-limits.md)                |  ● MEDIUM  | ⏳ TODO |
| #089 | [Add Support for Asset Path Payments](../issues/089-path-payments.md)                   |   ● HARD   | ⏳ TODO |
| #090 | [Formal Verification of Multi-Sig Logic](../issues/090-formal-verification.md)          |   ● HARD   | ⏳ TODO |
| #091 | [Implement Graceful Revert with Refund](../issues/091-graceful-revert.md)               |  ● MEDIUM  | ⏳ TODO |
| #092 | [Add SECP256K1 Signature Support](../issues/092-secp256k1-support.md)                   |  ● MEDIUM  | ⏳ TODO |
| #093 | [Implement Contract Metadata (SEP-0034)](../issues/093-contract-metadata.md)            |   ● EASY   | ⏳ TODO |
| #094 | [Build On-Chain Audit Trail for Bonuses](../issues/094-bonus-audit.md)                  |  ● MEDIUM  | ⏳ TODO |
| #095 | [Implement Emergency Pause (Circuit Breaker)](../issues/095-circuit-breaker.md)         |   ● EASY   | ⏳ TODO |

---

## 🛠 [BACKEND] Node.js / API / Database

_Focuses on project structure, database schema, payroll scheduling, and API logic._

| ID   | Issue Title                                                                                           | Difficulty | Status  |
| :--- | :---------------------------------------------------------------------------------------------------- | :--------: | :-----: |
| #011 | [Set Up Express.js Project Structure](../issues/011-express-ts-setup.md)                            |  ● MEDIUM  | ⏳ TODO |
| #012 | [Design & Migrate PostgreSQL Schema](../issues/012-db-schema-migrations.md)                         |  ● MEDIUM  | ✅ DONE |
| #013 | [Build Payroll Scheduling Engine](../issues/013-payroll-scheduler.md)                               |   ● HARD   | ✅ DONE |
| #014 | [Implement JWT Auth & RBAC](../issues/014-jwt-rbac-auth.md)                                         |   ● EASY   | ✅ DONE |
| #015 | [Build CSV Bulk Import Parser & Validator](../issues/015-csv-importer.md)                           |   ● HARD   | ⏳ TODO |
| #016 | [Integrate FX Rate API](../issues/016-fx-rate-api.md)                                               |  ● MEDIUM  | ⏳ TODO |
| #017 | [Build Employee CRUD API Endpoints](../issues/017-employee-crud-api.md)                             |   ● EASY   | ⏳ TODO |
| #018 | [Set Up Notification Service](../issues/018-notification-service.md)                                |  ● MEDIUM  | ⏳ TODO |
| #019 | [Implement Payroll Run Audit Log & Reporting](../issues/019-audit-reporting-api.md)                 |   ● HARD   | ⏳ TODO |
| #020 | [Dockerize Backend Service](../issues/020-docker-setup.md)                                          |   ● EASY   | ⏳ TODO |
| #044 | [OAuth2 Social Login Integration](../issues/044-oauth2-social-login.md)                             |  ● MEDIUM  | ⏳ TODO |
| #045 | [Multi-tenant Architecture Support](../issues/045-multi-tenant-architecture.md)                     |   ● HARD   | ⏳ TODO |
| #046 | [Two-Factor Authentication (2FA)](../issues/046-2fa-support.md)                                     |  ● MEDIUM  | ✅ DONE |
| #047 | [Data Export System (PDF/Excel)](../issues/047-data-export-system.md)                               |  ● MEDIUM  | ⏳ TODO |
| #048 | [Webhook System for Integrations](../issues/048-webhook-system.md)                                  |   ● HARD   | ⏳ TODO |
| #049 | [Support for Performance Bonuses](../issues/049-performance-bonuses.md)                             |   ● EASY   | ⏳ TODO |
| #050 | [Employee Profile Management](../issues/050-employee-profile-mgmt.md)                               |   ● EASY   | ⏳ TODO |
| #051 | [Advanced Search & Filtering](../issues/051-advanced-search-filtering.md)                           |  ● MEDIUM  | ⏳ TODO |
| #052 | [API Versioning Strategy](../issues/052-api-versioning.md)                                          |   ● EASY   | ⏳ TODO |
| #053 | [Email/System Monitoring (ELK Stack)](../issues/053-monitoring-logging.md)                          |   ● HARD   | ⏳ TODO |
| #054 | [API Rate Limiting](../issues/054-api-rate-limiting.md)                                             |   ● EASY   | ⏳ TODO |
| #055 | [Health Dashboard API](../issues/055-health-api.md)                                                 |   ● EASY   | ⏳ TODO |
| #056 | [Custom Tax Calculations Support](../issues/056-tax-calculations.md)                                |  ● MEDIUM  | ⏳ TODO |
| #077 | [Contract Event Indexer Service](../issues/077-contract-event-indexer.md)                           |   ● HARD   | ✅ DONE |
| #078 | [Contract Address Registry API](../issues/078-contract-address-registry-api.md)                     |  ● MEDIUM  | ⏳ TODO |
| #079 | [Preflight Balance Check Service](../issues/079-preflight-balance-check.md)                         |  ● MEDIUM  | ⏳ TODO |
| #080 | [Transaction History Backend Integration](../issues/080-transaction-history-backend-integration.md) |  ● MEDIUM  | ⏳ TODO |
| #081 | [Payroll Scheduler Backend Wiring](../issues/081-payroll-scheduler-backend-wiring.md)               |   ● HARD   | ⏳ TODO |
| #096 | [OAuth2 Social Login Integration Expansion](../issues/096-oauth2-social-login.md)                   |  ● MEDIUM  | ⏳ TODO |
| #097 | [Add Swagger/OpenAPI Documentation](../issues/097-openapi-docs.md)                                  |   ● EASY   | ⏳ TODO |
| #098 | [Implement Redis-Based Queue for Payroll](../issues/098-redis-queue.md)                             |   ● HARD   | ⏳ TODO |
| #099 | [Build Advanced Reporting Engine (PDF/Excel)](../issues/099-reporting-engine.md)                    |  ● MEDIUM  | ⏳ TODO |
| #100 | [Implement Webhook Notification System](../issues/100-webhook-system.md)                            |   ● HARD   | ⏳ TODO |

---

## 🎨 [FRONTEND] React / TypeScript / UI

_Focuses on dashboard layout, wallet connection, management UI, and analytics._

| ID   | Issue Title                                                                               | Difficulty | Status  |
| :--- | :---------------------------------------------------------------------------------------- | :--------: | :-----: |
| #021 | [Scaffold React 19 + Vite Project](../issues/021-react-vite-setup.md)                   |  ● MEDIUM  | ⏳ TODO |
| #022 | [Build Employer Dashboard Layout](../issues/022-dashboard-layout.md)                    |   ● EASY   | ✅ DONE |
| #023 | [Implement Wallet Connect Flow](../issues/023-wallet-connect-ui.md)                     |   ● HARD   | ✅ DONE |
| #024 | [Build Employee Management Table](../issues/024-employee-table-ui.md)                   |  ● MEDIUM  | ⏳ TODO |
| #025 | [Build CSV Upload UI](../issues/025-csv-upload-ui.md)                                   |  ● MEDIUM  | ✅ DONE |
| #026 | [Build Payroll Analytics Dashboard](../issues/026-analytics-dashboard.md)               |   ● HARD   | ⏳ TODO |
| #027 | [Build Employee Portal History View](../issues/027-employee-portal.md)                  |   ● EASY   | ⏳ TODO |
| #028 | [Implement QR Code Onboarding](../issues/028-employee-onboarding-ui.md)                 |  ● MEDIUM  | ⏳ TODO |
| #029 | [Add Toast Notification System](../issues/029-toast-notification-system.md)             |   ● EASY   | ⏳ TODO |
| #030 | [Build Payroll Scheduling Config UI](../issues/030-payroll-scheduling-ui.md)            |   ● HARD   | ⏳ TODO |
| #057 | [Theme Switcher (Light/Dark Mode)](../issues/057-theme-switcher.md)                     |   ● EASY   | ⏳ TODO |
| #058 | [Multi-language Support (i18n)](../issues/058-multi-language-support.md)                |  ● MEDIUM  | ⏳ TODO |
| #059 | [Interactive Onboarding Tour](../issues/059-interactive-onboarding.md)                  |  ● MEDIUM  | ⏳ TODO |
| #060 | [Advanced Filter UI for Transactions](../issues/060-advanced-filter-ui.md)              |  ● MEDIUM  | ⏳ TODO |
| #061 | [WebSocket Integration for Real-time Updates](../issues/061-websocket-integration.md)   |   ● HARD   | ⏳ TODO |
| #062 | [Organization Settings Page](../issues/062-org-settings-page.md)                        |   ● EASY   | ⏳ TODO |
| #063 | [Custom Report Builder UI](../issues/063-custom-report-builder.md)                      |   ● HARD   | ⏳ TODO |
| #064 | [Drag-and-Drop Employee Reordering](../issues/064-employee-reordering.md)               |   ● EASY   | ⏳ TODO |
| #065 | [Session Timeout Warnings](../issues/065-session-timeout-ui.md)                         |   ● EASY   | ⏳ TODO |
| #066 | [Mobile Responsive Optimization](../issues/066-mobile-responsive.md)                    |  ● MEDIUM  | ⏳ TODO |
| #067 | [Profile Pictures / Gravatar Support](../issues/067-profile-pictures.md)                |   ● EASY   | ⏳ TODO |
| #068 | [Interactive Documentation Page](../issues/068-documentation-page.md)                   |  ● MEDIUM  | ⏳ TODO |
| #069 | [Form Autosave for Configurations](../issues/069-form-autosave.md)                      |  ● MEDIUM  | ⏳ TODO |
| #070 | [Error Boundaries & Crash Reporting](../issues/070-error-boundaries.md)                 |  ● MEDIUM  | ⏳ TODO |
| #071 | [Soroban Contract Invocation Hook](../issues/071-soroban-contract-invocation-hook.md)   |   ● HARD   | ⏳ TODO |
| #072 | [Vesting Escrow UI Component](../issues/072-vesting-escrow-ui.md)                       |  ● MEDIUM  | ⏳ TODO |
| #073 | [Bulk Payment Status Tracker](../issues/073-bulk-payment-status-tracker.md)             |  ● MEDIUM  | ⏳ TODO |
| #074 | [Revenue Split Dashboard](../issues/074-revenue-split-dashboard.md)                     |   ● HARD   | ⏳ TODO |
| #075 | [Cross-Asset Payment Integration](../issues/075-cross-asset-payment-integration.md)     |   ● HARD   | ⏳ TODO |
| #076 | [Wallet Session Persistence](../issues/076-wallet-session-persistence.md)               |  ● MEDIUM  | ⏳ TODO |
| #082 | [Contract Error Parsing UI](../issues/082-contract-error-parsing-ui.md)                 |  ● MEDIUM  | ⏳ TODO |
| #083 | [Employee Payout Claim Integration](../issues/083-employee-payout-claim-integration.md) |   ● HARD   | ⏳ TODO |
| #084 | [Contract Upgrade Migration UI](../issues/084-contract-upgrade-migration-ui.md)         |   ● HARD   | ⏳ TODO |
| #085 | [Network Switch (Testnet/Mainnet)](../issues/085-network-switch-testnet-mainnet.md)     |  ● MEDIUM  | ⏳ TODO |
