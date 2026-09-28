# API Versioning Strategy

## Overview

PayD API uses URL-based versioning to ensure backward compatibility as the platform evolves. All API endpoints are versioned using a version prefix in the URL path.

## Current Version

- **Current Version:** `v1`
- **Supported Versions:** `v1`
- **Base URL:** `/api/v1/`

## Version Format

API versions follow the format `v{major}` where `{major}` is an incrementing integer:

```
/api/v1/employees
/api/v2/employees (future)
```

## Making Requests

### Versioned Endpoints (Recommended)

```bash
# Recommended: Use explicit version
GET /api/v1/employees
POST /api/v1/payroll-bonus/runs
GET /api/v1/payroll/audit
GET /api/v1/webhooks
GET /api/v1/notifications
GET /api/v1/rates
GET /api/v1/stellar-throttling
```

### Legacy Endpoints (Deprecated)

Legacy endpoints without version prefix are still supported but deprecated:

```bash
# Deprecated: Will be sunset 2027-01-01
GET /api/employees
POST /api/payroll-bonus/runs
GET /api/stellar-throttling
GET /rates
GET /webhooks
GET /api/notifications
```

## Response Headers

All API responses include version-related headers:

| Header                     | Description                                |
| -------------------------- | ------------------------------------------ |
| `X-API-Version`            | The API version handling the request       |
| `X-API-Current-Version`    | The latest stable API version              |
| `X-API-Supported-Versions` | Comma-separated list of supported versions |

### Deprecation Headers

When using deprecated endpoints or versions, additional headers are included:

| Header                      | Description                                              |
| --------------------------- | -------------------------------------------------------- |
| `Deprecation`               | `true` if the endpoint/version is deprecated             |
| `Sunset`                    | Date when the endpoint will be removed (RFC 1123 format) |
| `X-API-Deprecation-Message` | Human-readable deprecation notice                        |
| `Link`                      | Link to the successor version endpoint                   |

### Example Response Headers

**Current Version:**

```
X-API-Version: v1
X-API-Current-Version: v1
X-API-Supported-Versions: v1
```

**Deprecated/Legacy Endpoint:**

```
X-API-Version: v1
X-API-Current-Version: v1
X-API-Supported-Versions: v1
Deprecation: true
Sunset: Sat, 01 Jan 2027 00:00:00 GMT
X-API-Deprecation-Message: Legacy API routes are deprecated. Please use /api/v1/ instead.
Link: </api/v1/employees>; rel="successor-version"
```

## Version Lifecycle

1. **Active** - Current version, fully supported
2. **Deprecated** - Still functional but marked for removal
3. **Sunset** - No longer available

## Deprecation Policy

- Minimum 6 months notice before removing a version
- Deprecation headers included in all responses
- Migration guide provided for breaking changes
- Legacy routes will sunset on **January 1, 2027**

## Adding New Versions

When creating a new API version:

1. Create a new directory: `src/routes/v2/`
2. Copy and modify routes as needed
3. Update `apiVersionMiddleware.ts` with new version config
4. Update this documentation
5. Add deprecation headers to previous version if needed

## Breaking vs Non-Breaking Changes

### Breaking Changes (Require New Version)

- Removing endpoints
- Changing required parameters
- Changing response structure
- Changing authentication requirements

### Non-Breaking Changes (No New Version Needed)

- Adding new endpoints
- Adding optional parameters
- Adding new response fields
- Bug fixes

## Migration Guide

### From Legacy to v1

Replace all `/api/` prefixes with `/api/v1/`:

```diff
- GET /api/employees
+ GET /api/v1/employees

- POST /api/payroll-bonus/runs
+ POST /api/v1/payroll-bonus/runs

- GET /api/payroll/audit
+ GET /api/v1/payroll/audit
```

## Complete /api/v1 Route Map

| Prefix | Description |
|---|---|
| `/api/v1/auth` | Authentication (login, refresh, 2FA, OAuth) |
| `/api/v1/employees` | Employee management (CRUD, bulk import) |
| `/api/v1/payments` | Payment processing (SEP-31, SEP-24, path-find) |
| `/api/v1/assets` | Asset management |
| `/api/v1/payroll` | Payroll transactions |
| `/api/v1/payroll/audit` | Payroll audit logs |
| `/api/v1/payroll-bonus` | Performance bonus runs |
| `/api/v1/search` | Full-text search across employees and transactions |
| `/api/v1/webhooks` | Webhook subscriptions and delivery logs |
| `/api/v1/notifications` | Notification preferences |
| `/api/v1/rates` | Exchange rates |
| `/api/v1/stellar-throttling` | Stellar transaction throttling status/config |
| `/api/v1/contracts` | Contract registry and upgrade lifecycle |
| `/api/v1/bulk-payments` | Bulk payment batch operations |
| `/api/v1/exports` | Report and data exports |
| `/api/v1/freeze` | Asset freeze/unfreeze operations |
| `/api/v1/taxes` | Tax rule management |
| `/api/v1/balance` | Account balance queries |
| `/api/v1/trustline` | Trustline management |
| `/api/v1/multisig` | Multi-signature configuration |
| `/api/v1/fees` | Fee estimation |
| `/api/v1/claims` | Claimable balance claims |
| `/api/v1/path-payments` | Stellar path-payment routes |
| `/api/v1/audit` | Generic audit log access |
| `/api/v1/tenant-configs` | Per-tenant configuration |
| `/api/v1/throttling` | API throttling controls |
| `/api/v1/rate-limit` | Rate-limit tier information |

## API Root Endpoint

Get API information at the root endpoint:

```bash
GET /api
```

Response:

```json
{
  "name": "PayD API",
  "currentVersion": "v1",
  "supportedVersions": ["v1"],
  "endpoints": {
    "v1": "/api/v1"
  }
}
```
