# API Authentication Flow

This document describes how the PayD dashboard is currently secured based on the code in the backend and frontend.

## Current State

PayD currently uses JWT bearer tokens for authenticated API access.

Session cookies are not currently set by the backend auth controller, and there is no cookie middleware in the dashboard request flow. That means the dashboard is secured by tokens returned in JSON responses, not by an HTTP-only session cookie today.

## Login Flow

1. A user submits a wallet address to `POST /api/auth/login`.
2. The backend looks up the user and issues:
   - an `accessToken` signed with `JWT_SECRET` and a 1 hour lifetime
   - a `refreshToken` signed with `JWT_REFRESH_SECRET` and a 7 day lifetime for users that do not require 2FA
3. If the user has 2FA enabled, the backend returns `requires2fa: true` instead of issuing usable session tokens immediately.

## Two-Factor Flow

1. The user completes `POST /api/auth/2fa/verify`.
2. On success, the backend enables 2FA for the wallet and returns:
   - a fresh `accessToken`
   - a fresh `refreshToken`
3. The refresh token is also persisted on the user record so later refresh attempts can be compared against the stored token.

## Token Contents

The access token carries the claims the dashboard and APIs use to authorize requests:

- `id`
- `walletAddress`
- `organizationId`
- `role`
- `email` on some auth paths

Protected routes read the bearer token from the `Authorization` header and validate it with `authenticateJWT`. After verification, the decoded JWT is attached to `req.user`, which is then used for organization scoping and role checks.

## Dashboard Session Handling

For the social-login callback page, the frontend reads a `token` query parameter and stores it in `localStorage` as `payd_auth_token`.

Frontend services then attach that token as a bearer token when calling protected endpoints. This is the active dashboard session mechanism in the codebase today.

## Refresh Flow

1. The dashboard sends the refresh token to `POST /api/auth/refresh`.
2. The backend verifies the JWT signature and expiry of the refresh token.
3. The backend compares the supplied refresh token with the value stored on the user record.
4. If both checks pass, the backend returns a new 1 hour access token.

## What Session Cookies Do Today

Session cookies are not currently part of the implemented dashboard auth flow:

- the backend auth controller does not call `res.cookie(...)`
- the app does not register cookie-parsing middleware for auth
- the frontend callback stores a token in `localStorage`, not a cookie-backed session

## Security Implications

- API authorization is driven by short-lived access tokens.
- Long-lived access is controlled through refresh-token rotation by database lookup.
- Organization isolation depends on JWT claims such as `organizationId`.
- Because the current implementation is token-based instead of cookie-based, CSRF protections associated with cookie sessions are not the primary control here.
- Because the frontend stores the social-login token in `localStorage`, XSS hardening remains especially important.
