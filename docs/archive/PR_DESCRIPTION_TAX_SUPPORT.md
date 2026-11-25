# PR Description: Custom Tax Calculations Support

## Overview

This PR implements a flexible tax calculation engine for PayD, allowing organizations to define local tax rules (percentage or fixed) and automatically deduct them from payroll amounts before on-chain distribution. It also provides compliance reporting.

**Fixes #235**

## Changes

- **Tax Engine**: Leveraged `TaxService` to handle multi-rule tax calculations with priority ordering.
- **Worker Integration**: Updated `payrollWorker.ts` to automatically:
  1. Calculate deductions for each payroll item before payment.
  2. Record deductions in the `tax_reports` table for compliance.
  3. Send the net amount (gross minus total tax) to the employee's wallet.
- **API Improvements**: Fixed `taxRoutes.ts` to properly wire up Rule CRUD, Deduction Calculation, and Report Generation endpoints.
- **Reporting**: Implemented aggregation logic for organization-wide tax compliance reports.
- **Testing**: Added/Fixed unit tests in `src/services/__tests__/taxService.test.ts` covering calculation accuracy, clamping, and report aggregation.

## Verification Results

- **Unit Tests**: 17/17 passed in `taxService.test.ts`.
- **Automatic Deductions**: Verified that the payroll worker now injects `taxService.calculateDeductions` and records results.

## Checklist

- [x] Configurable tax rules (percentage, fixed amount).
- [x] Automatic deduction logic in the payroll engine.
- [x] Tax reports generated per organization for local compliance.
- [x] All tests pass.
