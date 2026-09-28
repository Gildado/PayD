# Performance Bonus Feature

## Overview

The PayD platform now supports one-time performance bonuses that can be added to payroll runs alongside regular base salary payments. Bonuses are processed in the same transaction batch but are clearly distinguished in audit logs, receipts, and reports.

## Features

### 1. API Support for Bonus Items

#### Add Single Bonus

```http
POST /api/v1/payroll-bonus/items/bonus
Content-Type: application/json

{
  "payrollRunId": 123,
  "employeeId": 456,
  "amount": "500.0000000",
  "description": "Q1 Performance Bonus",
  "metadata": "Manager-approved bonus payout"
}
```

#### Add Batch Bonuses

```http
POST /api/v1/payroll-bonus/items/bonus/batch
Content-Type: application/json

{
  "payrollRunId": 123,
  "items": [
    {
      "employeeId": 456,
      "amount": "500.0000000",
      "description": "Q1 Performance Bonus",
      "metadata": "Exceeded quarterly revenue goal"
    },
    {
      "employeeId": 789,
      "amount": "750.0000000",
      "description": "Project Completion Bonus",
      "metadata": "Delivered Phase 2 milestones"
    }
  ]
}
```

#### Get Payroll Items (Filtered by Type)

```http
GET /api/v1/payroll-bonus/runs/{payrollRunId}/items?itemType=bonus
```

### 2. Audit Logs with Item Type Distinction

All audit log entries now include `item_type` in the metadata field:

```json
{
  "action": "item_added",
  "metadata": {
    "item_type": "bonus",
    "description": "Q1 Performance Bonus",
    "payout_metadata": "Manager-approved bonus payout"
  }
}
```

Audit actions that track item_type:

- `item_added` - When bonus/base items are added
- `transaction_submitted` - When transactions are submitted to blockchain
- `transaction_succeeded` - When transactions complete successfully
- `transaction_failed` - When transactions fail

### 3. Receipt Generation with Bonus Distinction

PDF receipts now clearly indicate payment type:

**For Bonus Payments:**

- Header shows "🎉 PERFORMANCE BONUS"
- Description: "Performance Bonus Payment (XLM)"
- Includes bonus reason/description if provided

**For Base Salary:**

- Description: "Base Salary Payment (XLM)"

### 4. Correct Total Aggregation

The payroll engine maintains three separate totals:

- `total_base_amount` - Sum of all base salary items
- `total_bonus_amount` - Sum of all bonus items
- `total_amount` - Combined total (base + bonus)

These totals are automatically updated when items are added or removed.

## Database Schema

### payroll_runs table

```sql
total_base_amount DECIMAL(20, 7) DEFAULT 0
total_bonus_amount DECIMAL(20, 7) DEFAULT 0
total_amount DECIMAL(20, 7) DEFAULT 0
```

### payroll_items table

```sql
item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('base', 'bonus'))
description TEXT  -- Optional description for bonuses
metadata TEXT  -- Optional descriptive metadata for any payout item
```

### payroll_audit_logs table

```sql
metadata JSONB DEFAULT '{}'  -- Contains item_type and other contextual data
```

## Export Formats

### Excel Reports

- Summary sheet includes separate columns for base and bonus totals
- Transaction sheet includes "Payment Type" column

### CSV Reports

- Includes "paymentType" column (Base Salary / Bonus)
- Includes "description" column for bonus reasons

## Testing

Run the integration tests:

```bash
npm test -- performanceBonusFeature.test.ts
```

## Implementation Details

**Modified Files:**

- `services/payrollAuditService.ts` - Enhanced audit logging with item_type
- `services/exportService.ts` - Updated receipt/report generation
- `services/payrollBonusService.ts` - Added getPayrollItemByTxHash method
- `controllers/payrollBonusController.ts` - Added audit logging to controllers
- `controllers/exportController.ts` - Enriched receipts with item_type
- `workers/payrollWorker.ts` - Added audit logging during processing

**Key Changes:**

1. Audit log methods now accept optional `itemType` parameter
2. Receipt generation distinguishes between base and bonus payments
3. Export formats include payment type information
4. Worker logs audit entries with item_type during transaction processing
