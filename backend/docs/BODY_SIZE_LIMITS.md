# Body Size Limits Documentation

## Overview

PayD API implements per-route body size limits to protect against denial-of-service attacks and resource exhaustion. All limits include depth-check guards to prevent deeply nested JSON attacks.

## Configured Limits

### Standard API Routes (100KB)
Default limit for most API endpoints:
- Authentication endpoints
- Single-resource operations (create/update employee, payment)
- Search and query endpoints

### Bulk Operations (1MB)
For endpoints that process multiple records:
- `/api/employees/bulk-import` - CSV import with encoding overhead
- Batch payment operations
- Multi-record updates

### Large Imports/Exports (5MB)
For specialized import/export operations:
- Large CSV exports
- Historical data imports
- Backup/restore operations

### CSV Uploads (10MB)
Maximum size for raw CSV file uploads:
- Payroll CSV imports
- Employee roster uploads
- Transaction history uploads

## Depth Limit Guard

All routes enforce a maximum JSON nesting depth of **10 levels** to prevent stack overflow attacks from deeply nested payloads.

Example of rejected payload:
```json
{
  "level1": {
    "level2": {
      "level3": {
        // ... continues to level 15 - REJECTED
      }
    }
  }
}
```

## Error Responses

### Body Size Exceeded (413)
```json
{
  "errorCode": "VALIDATION_ERROR",
  "message": "Request body size exceeds maximum allowed limit",
  "timestamp": "2026-11-22T10:30:00.000Z",
  "requestId": "abc-123"
}
```

### Depth Limit Exceeded (413)
```json
{
  "errorCode": "VALIDATION_ERROR",
  "message": "Request rejected: JSON nesting depth exceeds maximum of 10 levels",
  "timestamp": "2026-11-22T10:30:00.000Z",
  "requestId": "abc-123"
}
```

## Implementation

### Applying Limits to Routes

```typescript
import { bodySizeLimit, BodySizeLimits } from '../middlewares/bodySizeLimitMiddleware.js';

// Standard API route
router.post(
  '/api/employees',
  ...bodySizeLimit(BodySizeLimits.STANDARD),
  employeeController.create
);

// Bulk operation with custom limit
router.post(
  '/api/employees/bulk-import',
  ...bodySizeLimit(BodySizeLimits.BULK),
  bulkImportController.import
);

// Disable depth check for specific use case
router.post(
  '/api/complex-nested-data',
  ...bodySizeLimit(BodySizeLimits.STANDARD, { checkDepth: false }),
  controller.handle
);
```

### Error Handler

The `bodySizeLimitErrorHandler` must be registered **after all routes** to catch and format body size errors:

```typescript
// All routes here
app.use('/api/employees', employeeRoutes);

// Error handler
app.use(bodySizeLimitErrorHandler);
```

## Testing

Body size limits are tested in:
- `backend/src/middlewares/__tests__/bodySizeLimitMiddleware.test.ts` - Unit tests
- `backend/src/controllers/__tests__/bulkImportController.test.ts` - Integration tests

## Monitoring

Monitor body size rejections via Prometheus metrics:
- `http_requests_total{status="413"}` - Count of oversized requests
- `http_request_duration_seconds{status="413"}` - Time spent rejecting oversized requests

## Acceptance Criteria

✅ Limits documented (this file)  
✅ Oversized body returns 413  
✅ Bulk endpoints still accept max batch

## Related

- [API Error Handling](./API_AUTHENTICATION.md)
- [Rate Limiting](../THROTTLING_README.md)
- [Security Headers](../src/middlewares/securityHeadersMiddleware.ts)
