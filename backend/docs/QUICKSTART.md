# SDS Integration: Quick Start Guide for Developers

## 5-Minute Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```
SDS_ENABLE=true
SDS_API_KEY=your-sds-api-key
SDS_ENDPOINT=https://sds-api.stellar.org
```

### 3. Start Development Server

```bash
npm run dev
```

Server runs on `http://localhost:3001`

### 4. Test SDS Integration

```bash
# Check health
curl http://localhost:3001/api/payroll/status/health

# Should return:
# {"success": true, "data": {"status": "healthy", "service": "SDS"}}
```

## Common Usage Patterns

### Get Employee Payroll

```typescript
import { payrollQueryService } from './services/payroll-query.service';

const orgKey = 'GBXXX...';
const employeeId = 'EMP-001';
const startDate = new Date('2024-01-01');
const endDate = new Date('2024-01-31');

const result = await payrollQueryService.getEmployeePayroll(
  orgKey,
  employeeId,
  startDate,
  endDate
);

console.log(`Employee: ${employeeId}`);
console.log(`Transactions: ${result.total}`);
console.log(`Total: ${result.data.reduce((sum, tx) => 
  sum + parseFloat(tx.amount || '0'), 0)}`);
```

### Generate Audit Report

```typescript
const auditReport = await payrollQueryService.getOrganizationAuditReport(
  orgKey,
  new Date('2024-01-01'),
  new Date('2024-12-31')
);

console.log('Audit Report:');
console.log(`Total transactions: ${auditReport.aggregation.totalCount}`);
console.log(`Total disbursed: ${auditReport.aggregation.totalDisbursed}`);
console.log(`Success rate: ${(
  auditReport.aggregation.successfulCount / 
  auditReport.aggregation.totalCount * 100
).toFixed(2)}%`);

// Batch-level summaries
Object.entries(auditReport.batchReports).forEach(([batchId, batch]) => {
  console.log(`Batch ${batchId}: ${batch.employeeCount} employees`);
});
```

### Query with Complex Filters

```typescript
const result = await payrollQueryService.queryPayroll(
  {
    organizationPublicKey: orgKey,
    employeeId: 'EMP-001',
    assetCode: 'USDC',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
  },
  1, // page
  50, // limit
  {
    enrichPayrollData: true,
    sortBy: 'timestamp',
    sortOrder: 'desc',
    useCache: true,
    cacheTtl: 3600000, // 1 hour
  }
);

console.log(`Found ${result.total} transactions`);
console.log(`Page ${result.page} of ${result.pageCount}`);
```

## Key Concepts

### Payroll Memo Format

Every transaction must have a memo following this format:

```
PAYROLL:<employee_id>:<batch_id>:<period>
```

Examples:
- `PAYROLL:EMP-001:BATCH-2024-01:2024-01`
- `PAYROLL:EMP-002:BATCH-2024-01:2024-01`

### Query Types

| Type | Method | Use Case |
|------|--------|----------|
| Simple | `queryPayroll()` | Any filtered query |
| Employee | `getEmployeePayroll()` | Single employee payroll |
| Batch | `getPayrollBatch()` | Batch audit |
| Org Audit | `getOrganizationAuditReport()` | Full org report |
| Summary | `getEmployeeSummary()` | Employee statistics |

### Caching

Results are cached automatically:

```typescript
// Cache hits for identical queries within TTL
const result1 = await query(); // API call
const result2 = await query(); // Cached result (~instantly)
```

Clear cache when needed:

```typescript
await payrollQueryService.clearCache();
```

## REST API Quick Reference

### Query Transactions

```bash
curl "http://localhost:3001/api/payroll/transactions?orgPublicKey=GBXXX&page=1&limit=50"
```

### Get Employee Payroll

```bash
curl "http://localhost:3001/api/payroll/employees/EMP-001?orgPublicKey=GBXXX"
```

### Get Organization Audit

```bash
curl "http://localhost:3001/api/payroll/audit?orgPublicKey=GBXXX&startDate=2024-01-01&endDate=2024-12-31"
```

### Get Aggregation Stats

```bash
curl "http://localhost:3001/api/payroll/aggregation?orgPublicKey=GBXXX"
```

## Debugging

### Enable Debug Logging

```bash
LOG_LEVEL=debug npm run dev
```

### Check SDS Health

```bash
curl http://localhost:3001/api/payroll/status/health
```

### Check Rate Limits

```bash
curl http://localhost:3001/api/payroll/status/rate-limit
```

### View Cache Stats

```bash
curl http://localhost:3001/api/payroll/cache/stats
```

## Performance Tips

1. **Use pagination** - Always paginate large queries
2. **Filter early** - Use SDS filters when possible
3. **Enable caching** - Cache repeated queries
4. **Batch queries** - Query multiple employees in one request
5. **Monitor rate limits** - Track SDS rate limit usage

## Benchmarking

Run performance benchmarks:

```bash
npm run test:benchmark
```

This generates a `benchmark-results-*.json` file with detailed metrics.

## Troubleshooting

### "SDS is not enabled"
Check `SDS_ENABLE=true` in `.env`

### "Invalid memo format"
Ensure memo: `PAYROLL:<emp_id>:<batch_id>:<period>`

### "Rate limited"
Check `SDS_API_KEY` and reduce request frequency

### "No results"
Verify `orgPublicKey` and date ranges are correct

## Next Steps

1. Read [SDS Integration Guide](./docs/SDS_INTEGRATION.md) for full details
2. Review [Indexing Strategy](./docs/INDEXING_STRATEGY.md) for memo format specs
3. Check [Benchmarking Results](./docs/BENCHMARKS.md) for performance data
4. Explore code in `src/services/` for implementation details

## Support

- Issues: GitHub issues
- Questions: Check inline code comments
- Documentation: See `backend/docs/` folder
