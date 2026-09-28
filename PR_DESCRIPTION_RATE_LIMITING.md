# PR Description: API Rate Limiting Implementation

## Overview

This PR implements Redis-backed API rate limiting to protect the PayD API from abuse. It utilizes the existing `RateLimitService` and `rateLimitMiddleware` to apply different limits for authentication routes versus data retrieval and general API routes.

**Fixes #233**

## Changes

- **Dependency Update**: Installed `express-rate-limit` and `rate-limit-redis` (via existing service integration).
- **App Integration**: Integrated `authRateLimit`, `apiRateLimit`, and `dataRateLimit` middlewares into `backend/src/app.ts`.
- **Route Specific Limiting**:
  - `authRateLimit`: Applied to `/auth`, `/api/auth` (10 requests per 15 min).
  - `apiRateLimit`: Applied to `/api/v1`, `/api/payroll`, `/api/payments`, `/api/webhooks`, `/api` (100 requests per min).
  - `dataRateLimit`: Applied to `/api/employees`, `/api/assets`, `/api/search` (200 requests per min).
- **Headers**: Added `X-RateLimit-*` and `Retry-After` headers to responses.
- **Testing**: Added integration tests in `backend/src/__tests__/rateLimiter.test.ts` to verify header presence and tier separation.

## Verification Results

Integration tests passed successfully:

- `should include rate limit headers for API routes` - PASS
- `should return 404/200 but still have headers even if unauthenticated` - PASS
- `should use different tiers for different routes` - PASS

## Checklist

- [x] Redis-backed rate limiter integrated.
- [x] `429 Too Many Requests` status returned when limits exceeded (via `RateLimitService`).
- [x] Rate limit headers included in API responses.
- [x] All tests pass.
