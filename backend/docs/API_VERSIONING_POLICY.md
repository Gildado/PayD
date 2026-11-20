# API Versioning and Deprecation Policy

This document describes how PayD's backend API evolves post-mainnet while maintaining backward compatibility and providing a clear migration path for clients.

## Versioning Strategy

PayD uses semantic versioning for API versions following the pattern `v{MAJOR}.{MINOR}.{PATCH}`.

### Version Structure
- **Major Version**: Breaking changes, removed endpoints, or incompatible responses (e.g., `v1`, `v2`, `v3`)
- **Minor Version**: Non-breaking additions like new endpoints or optional fields
- **Patch Version**: Bug fixes and internal improvements with no API changes

### URL Scheme
All API endpoints are versioned in the URL path:
```
/api/v1/payments/sep31/initiate
/api/v1/schedules
/api/v1/contract-events/search
```

## Deprecation Timeline

### Phase 1: Announcement (T+0 to T+30 days)
- New API version (`v2`) is released alongside current version (`v1`)
- Both versions are fully functional and supported
- Deprecation headers are added to `v1` endpoints
- Migration guide is published
- Clients are notified via email, documentation, and changelog

**Response Headers:**
```
Deprecated: true
Sunset: <RFC7231-date of v1 sunset (90 days from announcement)>
Link: </api/v2/payments/sep31/initiate>; rel="successor-version"
```

### Phase 2: Dual Support (T+30 to T+90 days)
- Both `v1` and `v2` are fully operational
- `v1` calls receive deprecation warnings in response headers
- Clients have 60 days to migrate
- Support team provides migration assistance
- API gateway logs migration metrics

### Phase 3: Maintenance (T+90+ days)
- `v1` is removed from production
- Traffic to `v1` is automatically redirected to `v2` with transformed responses (if possible)
- Permanent redirects (HTTP 301) for simple cases

## Breaking vs. Non-Breaking Changes

### Non-Breaking (Minor Version Bump / No Version Bump)
- Adding new optional fields to response JSON
- Adding new optional query parameters
- Adding new endpoints
- Reordering response fields (JSON is unordered)
- Adding new HTTP status codes to error responses
- Expanding enum values in responses

### Breaking (Major Version Bump)
- Removing or renaming fields from response JSON
- Removing or renaming endpoint paths
- Changing field types (e.g., string to number)
- Making previously optional fields required
- Changing response status codes for existing scenarios
- Removing query parameters or changing their semantics
- Changing authentication requirements

## Deprecation Warnings

### v1 to v2 Deprecation Example

#### Before (v1):
```http
POST /api/v1/payments/sep31/initiate
Content-Type: application/json
Authorization: Bearer <token>

{
  "domain": "example.com",
  "paymentData": { ... }
}
```

Response:
```http
HTTP/1.1 202 Accepted
Deprecated: true
Sunset: Wed, 31 Dec 2026 23:59:59 GMT
Link: </api/v2/payments/sep31/initiate>; rel="successor-version"
X-API-Warn: "v1 is deprecated; migrate to v2"

{
  "success": true,
  "requestId": "req_123",
  "transaction": { ... }
}
```

#### After (v2):
```http
POST /api/v2/payments/sep31/initiate
Content-Type: application/json
Authorization: Bearer <token>
Idempotency-Key: key_abc123

{
  "domain": "example.com",
  "paymentData": { ... }
}
```

Response:
```http
HTTP/1.1 202 Accepted

{
  "success": true,
  "data": {
    "requestId": "req_123",
    "transaction": { ... }
  }
}
```

## Deprecation Scenarios

### Scenario 1: Field Rename
**What changed:** `transaction` → `transactionData`

**v1 Response:**
```json
{
  "transaction": { "id": "tx_1", "amount": "100" }
}
```

**v2 Response:**
```json
{
  "transactionData": { "id": "tx_1", "amount": "100" }
}
```

**Migration:** Client must update response parsing code.

### Scenario 2: Response Wrapper
**What changed:** Top-level response fields are now wrapped in a `data` object

**v1 Response:**
```json
{
  "success": true,
  "id": "payment_123",
  "amount": "100"
}
```

**v2 Response:**
```json
{
  "success": true,
  "data": {
    "id": "payment_123",
    "amount": "100"
  }
}
```

**Migration:** Client must unwrap the `data` object.

### Scenario 3: Endpoint Consolidation
**What changed:** Multiple endpoints are merged into a single endpoint with a parameter

**v1 Routes:**
```
GET /api/v1/schedules/:id
GET /api/v1/schedules/:id/details
```

**v2 Routes:**
```
GET /api/v2/schedules/:id?includeDetails=true
```

**Migration:** Combine calls into a single request with parameters.

## Client Migration Guide

### Step 1: Identify v1 Usage
Search your codebase for:
```bash
grep -r "/api/v1/" .
```

### Step 2: Update Endpoint URLs
```javascript
// Before
const response = await fetch('/api/v1/payments/sep31/initiate', {
  method: 'POST',
  body: JSON.stringify(payload),
});

// After
const response = await fetch('/api/v2/payments/sep31/initiate', {
  method: 'POST',
  headers: {
    'Idempotency-Key': generateIdempotencyKey(),
  },
  body: JSON.stringify(payload),
});
```

### Step 3: Handle Response Changes
```javascript
// Before
const transaction = response.transaction;

// After
const transaction = response.data.transaction;
```

### Step 4: Test Against v2
- Run integration tests against v2 endpoints
- Verify error handling
- Test edge cases and error responses

### Step 5: Deploy and Monitor
- Deploy updated client code
- Monitor API logs for v1 usage
- Verify deprecation header reception
- Confirm v2 call success rates

## Rollback Plan

If critical issues are discovered after v2 launch:

1. **Immediate (0-24 hours):** Disable v2, extend v1 sunset date
2. **Short-term (1-7 days):** Investigate issues, develop fixes
3. **Medium-term (1-2 weeks):** Release v2.1 with fixes
4. **Resume deprecation:** Announce new sunset date

## API Gateway Configuration

### Header-Based Deprecation
```yaml
endpoints:
  - path: /api/v1/*
    deprecated: true
    sunset: "Wed, 31 Dec 2026 23:59:59 GMT"
    successorVersion: v2
    headers:
      Deprecated: "true"
      Sunset: "Wed, 31 Dec 2026 23:59:59 GMT"
      Link: "</api/v2/{endpoint}>; rel=\"successor-version\""
```

### Automatic Redirects (if applicable)
```yaml
redirects:
  - from: /api/v1/schedules
    to: /api/v2/schedules
    status: 301  # Permanent redirect
    transform: legacyPayloadTransformer
```

## Monitoring and Metrics

### Track These Metrics
- v1 vs v2 request volume
- v1 request error rates
- Migration timeline per client
- Deprecation header reception rate
- Clients still using v1 at sunset

### Alerting
- Alert if v1 usage increases unexpectedly
- Alert if v2 error rate exceeds v1
- Alert if any client hasn't migrated by T+60

## Questions and Support

For API versioning questions:
1. Check this policy and migration guide
2. Review changelog for specific version changes
3. Contact the backend team
4. Open an issue in the repository

## Changelog Entry Example

```markdown
## v2.0.0 - 2026-10-01

### Breaking Changes
- Wrapped all response objects in a `data` field
- Renamed `transaction` to `transactionData` in payment responses
- Removed deprecated `clientId` parameter from all endpoints

### New Features
- Added `Idempotency-Key` header support to payment endpoints
- Added Soroban RPC failover for improved reliability
- Added event indexing consistency improvements

### Migration
Detailed migration guide: [API Versioning Policy](./API_VERSIONING_POLICY.md)
v1 sunset date: December 31, 2026

### Deprecation
v1 is deprecated as of October 1, 2026 and will be removed on December 31, 2026.
See deprecation headers for more information.
```

## References

- RFC 7231 (HTTP/1.1 Semantics): https://tools.ietf.org/html/rfc7231
- Semantic Versioning: https://semver.org/
- API Versioning Best Practices: https://www.troyhunt.com/your-api-versioning-is-wrong/
