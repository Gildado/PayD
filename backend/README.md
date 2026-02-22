# PayD Backend - SDS Integration

TypeScript/Node.js backend service for PayD payroll platform with Stellar Data Service (SDS) integration for high-performance on-chain query processing and advanced payroll audit reporting.

## Features

✅ **SDS Integration** - High-performance on-chain data querying  
✅ **Custom Payroll Indexing** - Structured memo parsing and enrichment  
✅ **Query Abstraction** - Clean API for payroll operations  
✅ **Automatic Caching** - Reduced SDS API calls  
✅ **Retry Logic** - Exponential backoff for resilience  
✅ **Aggregate Reporting** - Organization-wide audit reports  
✅ **Performance Benchmarking** - SDS vs Horizon comparison  
✅ **REST API** - Comprehensive endpoints for all operations  

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- SDS API credentials
- Stellar account keys (for testing)

### Installation
# PayD Backend - Advanced Search & Filtering

This backend implements a powerful search and filtering engine for employee lists and transaction history using PostgreSQL full-text search.

## Features

- Full-text search using PostgreSQL `tsvector` and `ts_rank`
- Multi-criteria filtering (status, date ranges, amount ranges)
- Pagination support
- Performant with proper indexing
- Type-safe with TypeScript and Zod validation

## Setup

1. Install dependencies:

```bash
npm install
```

### Configuration

```bash
cp .env.example .env
# Edit .env with your credentials
```

Environment variables:

```
PORT=3001
SDS_ENABLE=true
SDS_API_KEY=your-api-key
SDS_ENDPOINT=https://sds-api.stellar.org
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
```

### Running

**Development**:
```bash
npm run dev
```

**Production**:
```bash
npm run build
npm start
```

**Tests**:
```bash
npm test
```

**Benchmarks**:
```bash
npm run test:benchmark
```

## Architecture

The backend is organized in layers:

```
Routes (Express)
    ↓
Services (Business Logic)
    ├─ PayrollQueryService
    ├─ PayrollIndexingService
    └─ SDSClient
        ↓
    Stellar Data Service
```

### Components

- **SDSClient** (`src/services/sds.service.ts`) - SDS API wrapper with retry/pagination
- **PayrollIndexingService** (`src/services/payroll-indexing.service.ts`) - Memo parsing and enrichment
- **PayrollQueryService** (`src/services/payroll-query.service.ts`) - High-level payroll APIs
- **Routes** (`src/routes/payroll.routes.ts`) - REST API endpoints
- **Config** (`src/config/index.ts`) - Environment configuration
- **Utils** (`src/utils/`) - Logging, pagination helpers

## API Endpoints

### Base URL
```
http://localhost:3001/api/payroll
```

### Payroll Queries

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/transactions` | GET | Query payroll transactions with filters |
| `/employees/:id` | GET | Get payroll for specific employee |
| `/employees/:id/summary` | GET | Employee payroll summary |
| `/batches/:id` | GET | Get payroll batch details |
| `/aggregation` | GET | Aggregated statistics |
| `/audit` | GET | Organization-wide audit report |
| `/search/memo` | GET | Search by memo pattern |
| `/transactions/:hash` | GET | Get transaction details |

### Status Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/status/health` | GET | SDS health check |
| `/status/rate-limit` | GET | Rate limit info |
| `/cache/stats` | GET | Cache statistics |
| `/cache/clear` | POST | Clear cache |

## Query Examples

### Get Employee Payroll

```bash
curl "http://localhost:3001/api/payroll/employees/EMP-001?orgPublicKey=GBXXX&startDate=2024-01-01&endDate=2024-01-31"
```

Response:
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "tx-hash-123",
        "sourceAccount": "GBXXX",
        "amount": "1500.00",
        "assetCode": "USDC",
        "timestamp": 1704067200,
        "memo": "PAYROLL:EMP-001:BATCH-2024-01:2024-01",
        "employeeId": "EMP-001",
        "payrollBatchId": "BATCH-2024-01",
        "period": "2024-01",
        "isPayrollRelated": true,
        "successful": true
      }
    ],
    "page": 1,
    "limit": 50,
    "total": 5,
    "hasMore": false
  }
}
```

### Get Audit Report

```bash
curl "http://localhost:3001/api/payroll/audit?orgPublicKey=GBXXX&startDate=2024-01-01&endDate=2024-12-31"
```

Response:
```json
{
  "success": true,
  "data": {
    "aggregation": {
      "totalCount": 1200,
      "successfulCount": 1180,
      "failedCount": 20,
      "totalDisbursed": "1500000.00",
      "avgPaymentAmount": "1271.19",
      "byAsset": {
        "USDC:GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTXJJWXVFJI...": {
          "count": 1200,
          "totalAmount": "1500000.00"
        }
      }
    },
    "batchReports": {
      "BATCH-2024-01": {
        "employeeCount": 100,
        "aggregation": {...}
      },
      "BATCH-2024-02": {
        "employeeCount": 100,
        "aggregation": {...}
      }
    },
    "dateRange": {
      "start": "2024-01-01T00:00:00.000Z",
      "end": "2024-12-31T23:59:59.999Z"
    }
  }
}
```

## Data Model

### PayrollTransaction

Extends SDSTransaction with payroll-specific fields:

```typescript
interface PayrollTransaction extends SDSTransaction {
  payrollMemo?: PayrollMemoFormat;
  isPayrollRelated: boolean;
  employeeId?: string;
  payrollBatchId?: string;
  period?: string;
}
```

### PayrollMemoFormat

```typescript
interface PayrollMemoFormat {
  type: 'PAYROLL' | 'BONUS' | 'INVOICE' | 'OTHER';
  employeeId?: string;
  payrollBatchId?: string;
  period?: string;
  rawMemo: string;
}
```

### Memo Formats

- **PAYROLL**: `PAYROLL:<employee_id>:<batch_id>:<period>`
- **BONUS**: `BONUS:<employee_id>:<description>`
- **INVOICE**: `INVOICE:<invoice_id>:<description>`

## Performance

Benchmarked against Horizon:

| Operation | Horizon | SDS | Improvement |
|-----------|---------|-----|-------------|
| Large dataset (10k) | 8500ms | 1200ms | **86% faster** |
| Org audit | 5000ms | 800ms | **84% faster** |
| Memory usage | 54MB | 18MB | **67% less** |
| API calls | 20+ | 1-2 | **90% reduction** |

See [BENCHMARKS.md](./docs/BENCHMARKS.md) for detailed results.

## Caching

Automatic result caching with configurable TTL:

```typescript
// Enable caching
await payrollQueryService.queryPayroll(query, page, limit, {
  useCache: true,
  cacheTtl: 3600000  // 1 hour
});

// Clear cache
await payrollQueryService.clearCache();

// Get cache stats
const stats = payrollQueryService.getCacheStats();
```

## Error Handling

All errors return consistent format:

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

Standard HTTP status codes:
- **400**: Bad request (missing parameters)
- **404**: Not found (transaction/resource)
- **500**: Server error

## Development

### Building

```bash
npm run build
```

Output in `dist/` directory.

### Linting

```bash
npm run lint
```

### Type Checking

```bash
npm run type-check
```

## Deployment

### Docker

```bash
docker build -t payd-backend .
docker run -p 3001:3001 --env-file .env payd-backend
```

### Environment Variables (Production)

```
PORT=3001
NODE_ENV=production
SDS_ENABLE=true
SDS_API_KEY=production-key
SDS_ENDPOINT=https://sds-api.stellar.org
SDS_TIMEOUT=30000
SDS_RETRY_ATTEMPTS=3
ENABLE_CACHING=true
CACHE_TTL=7200000
LOG_LEVEL=info
```

## Documentation

- [SDS Integration Guide](./docs/SDS_INTEGRATION.md) - Complete SDS implementation details
- [Indexing Strategy](./docs/INDEXING_STRATEGY.md) - Technical deep-dive on payroll indexing
- [Benchmarking Results](./docs/BENCHMARKS.md) - Performance comparison data
- [API Reference](./docs/API.md) - Detailed endpoint documentation

## Configuration Reference

See `src/config/index.ts` for all configuration options:

```typescript
config = {
  port: number,
  nodeEnv: 'development' | 'production',
  stellar: {
    networkPassphrase: string,
    horizonUrl: string
  },
  sds: {
    enabled: boolean,
    apiKey: string,
    endpoint: string,
    timeout: number,
    retryAttempts: number,
    retryDelay: number
  },
  database: { ... },
  cache: {
    enabled: boolean,
    ttl: number
  },
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
  }
}
```

## Troubleshooting

### SDS Connection Issues

```bash
# Check health
curl http://localhost:3001/api/payroll/status/health

# Check rate limits
curl http://localhost:3001/api/payroll/status/rate-limit

# Verify SDS credentials in .env
```

### Memo Parsing

Ensure transactions use standardized memo format:

```
PAYROLL:<employee_id>:<batch_id>:<period>
```

Memos must be 28 characters or less (Stellar limit).

### Performance Issues

1. Check cache hit rate: `GET /api/payroll/cache/stats`
2. Verify pagination (limit to 50-500)
3. Review query filters (use server-side filters when possible)
4. Check SDS rate limits: `GET /api/payroll/status/rate-limit`

## Support

Issues and questions:
- Submit GitHub issues
- Check inline code documentation
- Review SDS Integration Guide

## License

MIT - See LICENSE file

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## Changelog

### v1.0.0 (Current)
- ✨ Initial SDS integration
- 🎯 Payroll indexing service
- 📊 Performance benchmarking
- 🚀 REST API endpoints
- 💾 Query caching
- 🔄 Retry logic with exponential backoff
2. Create a `.env` file:

```bash
cp .env.example .env
```

3. Configure your database connection in `.env`:

```
DATABASE_URL=postgresql://user:password@localhost:5432/payd
PORT=3000
NODE_ENV=development
```

4. Run the database migration:

```bash
psql -d payd -f src/db/migrations/001_create_tables.sql
```

5. Start the development server:

```bash
npm run dev
```

## API Endpoints

### Search Employees

```
GET /api/search/organizations/:organizationId/employees
```

Query Parameters:

- `query` - Full-text search on name, email, position, department
- `status` - Filter by status (comma-separated: active,inactive,pending)
- `dateFrom` - Filter by creation date (ISO 8601)
- `dateTo` - Filter by creation date (ISO 8601)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `sortBy` - Sort column (created_at, first_name, last_name, email, status)
- `sortOrder` - Sort order (asc, desc)

Example:

```bash
curl "http://localhost:3000/api/search/organizations/1/employees?query=john&status=active&page=1&limit=20"
```

Response:

```json
{
  "data": [
    {
      "id": 1,
      "organization_id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "wallet_address": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      "status": "active",
      "position": "Software Engineer",
      "department": "Engineering",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### Search Transactions

```
GET /api/search/organizations/:organizationId/transactions
```

Query Parameters:

- `query` - Full-text search on tx_hash, asset_code
- `status` - Filter by status (comma-separated: pending,completed,failed)
- `dateFrom` - Filter by creation date (ISO 8601)
- `dateTo` - Filter by creation date (ISO 8601)
- `amountMin` - Minimum transaction amount
- `amountMax` - Maximum transaction amount
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `sortBy` - Sort column (created_at, amount, status, tx_hash)
- `sortOrder` - Sort order (asc, desc)

Example:

```bash
curl "http://localhost:3000/api/search/organizations/1/transactions?query=abc123&status=completed&amountMin=100&amountMax=1000&page=1"
```

Response:

```json
{
  "data": [
    {
      "id": 1,
      "organization_id": 1,
      "employee_id": 5,
      "tx_hash": "abc123def456...",
      "amount": "500.0000000",
      "asset_code": "USDC",
      "status": "completed",
      "transaction_type": "payment",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z",
      "employee_first_name": "Jane",
      "employee_last_name": "Smith"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

## Database Schema

The implementation uses PostgreSQL's full-text search capabilities:

- `tsvector` columns are automatically generated and stored
- GIN indexes on `search_vector` for fast full-text queries
- B-tree indexes on frequently filtered columns (status, dates, amounts)
- `ts_rank()` function for relevance scoring

### Full-Text Search Weights

Employees:

- A (highest): first_name, last_name
- B: email
- C: position, department

Transactions:

- A (highest): tx_hash
- B: asset_code
- C: status

## Performance Considerations

- Pagination limits prevent large result sets
- Indexes on all filterable columns
- Generated `tsvector` columns for instant search
- Connection pooling for database efficiency
- Query parameter validation to prevent SQL injection

## Development

Build for production:

```bash
npm run build
npm start
```

Run tests:

```bash
npm test
```

Run tests with coverage:

```bash
npm test -- --coverage
```

Run tests in watch mode:

```bash
npm run test:watch
```

Lint code:

```bash
npm run lint
```

Format code:

```bash
npm run format
```

## Testing

This project includes comprehensive unit and integration tests covering:

- Full-text search functionality
- Multi-criteria filtering
- Pagination logic
- Error handling
- Edge cases

See [TESTING.md](TESTING.md) for detailed testing documentation.

### Test Coverage

- 60+ test cases
- Unit tests for search service logic
- Integration tests for API endpoints
- Mocked database for fast, reliable tests

Run tests:

```bash
npm test
```

View coverage report:

```bash
npm test -- --coverage
open coverage/lcov-report/index.html
```
