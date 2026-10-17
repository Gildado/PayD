# PayD Anomaly Detection Agents Architecture & Operational Guide

This document describes the design, configuration, detection rules, alert taxonomy, and operational runbooks for the four proactive Anomaly Detection Agents implemented across PayD's payroll, fee estimation, trustline, and claimable balance pipelines.

---

## Table of Contents
1. [Overview & Design Principles](#overview--design-principles)
2. [Shared Anomaly Event Schema](#shared-anomaly-event-schema)
3. [Agent 1: CSV Import Anomaly & Formula Injection Detection Agent (#1200)](#agent-1-csv-import-anomaly--formula-injection-detection-agent-1200)
4. [Agent 2: Fee Estimation Drift Detection Agent (#1201)](#agent-2-fee-estimation-drift-detection-agent-1201)
5. [Agent 3: Unauthorized Trustline Change Detection Agent (#1202)](#agent-3-unauthorized-trustline-change-detection-agent-1202)
6. [Agent 4: Claimable Balance Abuse Detection Agent (#1203)](#agent-4-claimable-balance-abuse-detection-agent-1203)
7. [Operational Runbooks & Incident Response](#operational-runbooks--incident-response)
8. [Configuration & Environment Reference](#configuration--environment-reference)

---

## 1. Overview & Design Principles

All agents adhere to the following architectural requirements:
- **Zero-Block Guarantees**: Detection runs asynchronously or non-blockingly (`.catch(...)`), ensuring critical business operations (e.g. employee payouts, CSV parsing, fee queries) are never disrupted or delayed if an anomaly is detected or evaluated.
- **Configurable Without Code Changes**: All thresholds, windows, and baselines can be customized via constructor parameters or standard environment variables.
- **Structured Downstream Alerting**: Agents emit standardized `AnomalyEvent` records compatible with SIEM, Winston/Elasticsearch logging, webhooks, and incident alerting pipelines.
- **Deterministic Testing**: Each agent provides verified true-positive and true-negative fixture test suites runnable directly in CI/CD without external database dependencies.

---

## 2. Shared Anomaly Event Schema

All agents emit the unified `AnomalyEvent` type defined in `src/types/anomalyEvent.ts`:

```typescript
export type AnomalySeverity = 'info' | 'warning' | 'critical';

export interface AnomalyEvent {
  id: string;               // Unique UUID v4
  agentId: string;          // Identifier of detecting agent
  organizationId?: number;  // Multi-tenant organization scope
  severity: AnomalySeverity;
  reason: string;           // Machine-readable reason code
  title: string;            // Human-readable title
  description: string;      // Detailed context
  detectedAt: string;       // ISO 8601 timestamp
  metadata: Record<string, unknown>; // Rich diagnostic payload
}
```

---

## 3. Agent 1: CSV Import Anomaly & Formula Injection Detection Agent (#1200)

**Source File**: `backend/src/services/csvImportAnomalyDetectionAgent.ts`  
**Wired Into**: `backend/src/services/csvPayrollImportService.ts`

### Detection Capabilities
1. **Formula & Command Injection**:
   - Detects formula prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`, `|`, `%`) in employee names, remarks, or metadata fields.
   - Specifically flags dangerous DDE / external link functions such as `HYPERLINK`, `CMD`, `EXEC`, `SYSTEM`, `DDE`.
   - Severity: `critical`.
2. **Extreme Salary Outliers**:
   - Compares employee salary against configurable ceilings (`CSV_ANOMALY_SALARY_THRESHOLD`, default $50,000) or dynamic multiplier standard deviations from batch median.
   - Severity: `critical`.
3. **Sybil & Wallet Reuse Collusion**:
   - Detects duplicate Stellar/wallet addresses within a single batch attempting multi-account split payouts.
   - Severity: `warning`.
4. **Elevated Batch Failure Ratios**:
   - Flags when batch parsing failures exceed a configured threshold percentage (default 30%).
   - Severity: `warning`.

---

## 4. Agent 2: Fee Estimation Drift Detection Agent (#1201)

**Source File**: `backend/src/services/feeEstimationDriftDetectionAgent.ts`  
**Wired Into**: `backend/src/services/feeEstimationService.ts`

### Detection Capabilities
1. **Rolling Baseline Fee Surge Drift**:
   - Maintains a sliding window (default 10 samples) of recommended fees.
   - Detects sudden surges where current fee exceeds `FEE_DRIFT_MULTIPLIER_THRESHOLD` (default 3.0x) times the rolling baseline median.
   - Severity: `warning`.
2. **Absolute Fee Ceiling Breaches**:
   - Flags fee recommendations exceeding `FEE_DRIFT_MAX_FEE_STROOPS` (default 10,000 Stroops / 0.001 XLM).
   - Severity: `critical`.
3. **Congestion-Fee Inversion**:
   - Detects edge cases where network ledger capacity usage is critical (>= 80% saturation) yet recommended fee remains at minimum base fee (100 Stroops), preventing transactions from dropping or stalling during network surges.
   - Severity: `warning`.

---

## 5. Agent 3: Unauthorized Trustline Change Detection Agent (#1202)

**Source File**: `backend/src/services/unauthorizedTrustlineChangeDetectionAgent.ts`  
**Wired Into**: `backend/src/services/trustlineService.ts`

### Detection Capabilities
1. **Unapproved Asset Trustline Codes**:
   - Validates asset against whitelist (`USDC`, `EURC`, `XLM`, `ORGUSD`, `PAYD`, `USD`).
   - Rejects unapproved or suspicious tokens.
   - Severity: `critical`.
2. **Unapproved Asset Issuers**:
   - Validates that issuer public key matches approved organization/partner keys if configured.
   - Severity: `critical`.
3. **Workflow Bypasses**:
   - Detects trustlines moving directly from `none` to `established` without passing through the required organization `pending` invite state.
   - Severity: `warning`.
4. **Rapid Trustline Churn / Modification Bursts**:
   - Flags accounts with more than `RAPID_TRUSTLINE_THRESHOLD` (default 4) modifications within a sliding window (default 60 seconds).
   - Severity: `warning`.

---

## 6. Agent 4: Claimable Balance Abuse Detection Agent (#1203)

**Source File**: `backend/src/services/claimableBalanceAbuseDetectionAgent.ts`  
**Wired Into**: `backend/src/services/claimableBalanceService.ts`

### Detection Capabilities
1. **Micro / Dust Balance Flooding**:
   - Flags claimable balances with amounts <= `CLAIMABLE_DUST_THRESHOLD` (default 0.001 units).
   - Severity: `warning`.
2. **High-Value Single Balance Outliers**:
   - Flags claimable balances with amounts >= `CLAIMABLE_CRITICAL_AMOUNT_THRESHOLD` (default 50,000 units).
   - Severity: `critical`.
3. **Abnormal Expiration Windows**:
   - Flags balances created with zero or sub-1-day expiration times.
   - Severity: `warning`.
4. **Rapid Creation Burst Flooding**:
   - Detects more than `CLAIMABLE_MAX_CREATIONS_PER_WINDOW` (default 10) balance creations per organization within 60 seconds.
   - Severity: `warning`.

---

## 7. Operational Runbooks & Incident Response

### CSV Injection / Outlier Response Runbook
1. If an anomaly event with reason `formula_injection_detected` fires:
   - Quarantine the uploaded CSV file ID.
   - Do not export or open the file in Microsoft Excel or LibreOffice Calc without sanitization.
   - Review employee records and notify organization admin.
2. If an anomaly event with reason `excessive_salary_outlier` fires:
   - Require dual-admin multi-sig signoff prior to batch dispatch.

### Fee Drift Response Runbook
1. If `fee_surge_drift` or `absolute_fee_surge` fires:
   - Check Stellar network status / Horizon ledger close times.
   - If congestion is artificial or fee spike is extreme, enable fee-bump caps or defer low-priority payroll batches until network stabilizes.

### Trustline Security Runbook
1. If `unapproved_asset_trustline` fires:
   - Verify if employee is interacting with phishing tokens or spoofed assets.
   - Disallow payroll settlement in unauthorized asset.

### Claimable Balance Flood Runbook
1. If `dust_balance_spam` or `creation_burst_flood` fires:
   - Temporarily throttle claimant or sponsoring organization API key.
   - Check base reserve consumption on sponsor account.

---

## 8. Configuration & Environment Reference

| Environment Variable | Default Value | Description |
|----------------------|---------------|-------------|
| `CSV_ANOMALY_SALARY_THRESHOLD` | `50000` | Max single salary threshold before flagging outlier |
| `CSV_ANOMALY_MAX_FAIL_RATE` | `0.30` | Max batch parse failure ratio (30%) |
| `FEE_DRIFT_MULTIPLIER_THRESHOLD` | `3.0` | Multiplier over rolling baseline for fee drift |
| `FEE_DRIFT_MAX_FEE_STROOPS` | `10000` | Absolute ceiling for recommended fees |
| `FEE_DRIFT_ROLLING_WINDOW_SIZE` | `10` | Number of samples in rolling baseline window |
| `APPROVED_ASSET_CODES` | `USDC,EURC,XLM,ORGUSD,PAYD,USD` | Comma-separated approved asset symbols |
| `RAPID_TRUSTLINE_THRESHOLD` | `4` | Max trustline changes per window before flagging churn |
| `RAPID_TRUSTLINE_WINDOW_MS` | `60000` | Window in milliseconds for trustline churn |
| `CLAIMABLE_DUST_THRESHOLD` | `0.001` | Minimum threshold below which balance is dust |
| `CLAIMABLE_CRITICAL_AMOUNT_THRESHOLD` | `50000` | Single claimable balance critical amount threshold |
| `CLAIMABLE_MAX_CREATIONS_PER_WINDOW` | `10` | Max claimable balances created per organization window |
| `CLAIMABLE_BURST_WINDOW_MS` | `60000` | Window in milliseconds for claimable balance bursts |
