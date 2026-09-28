# API Authentication Flow

## Overview

PayD backend uses **JWT (JSON Web Token)** based authentication for securing API endpoints. This document provides a comprehensive guide to the authentication flow, token management, and security best practices.

---

## Table of Contents

1. [Authentication Architecture](#authentication-architecture)
2. [Token Types](#token-types)
3. [Authentication Flow](#authentication-flow)
4. [API Endpoints](#api-endpoints)
5. [Using Authentication](#using-authentication)
6. [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
7. [Security Best Practices](#security-best-practices)
8. [Error Handling](#error-handling)
9. [Testing Authentication](#testing-authentication)

---

## Authentication Architecture

### Components

- **JWT Middleware** (`src/middlewares/auth.ts`): Validates Bearer tokens on protected routes
- **Auth Service** (`src/services/authService.ts`): Generates and verifies JWT tokens
- **Auth Routes** (`src/routes/authRoutes.ts`): Handles login, registration, token refresh
- **RBAC Middleware** (`src/middlewares/rbac.ts`): Enforces role-based permissions
- **2FA Middleware** (`src/middlewares/require2fa.ts`): Enforces two-factor authentication

### Token Storage

- **Access Token**: Short-lived (1 hour), sent in `Authorization` header
- **Refresh Token**: Long-lived (7 days), stored securely client-side
- **Session**: Stateless (no server-side session storage)

---

## Token Types

### Access Token

```json
{
  "id": 123,
  "walletAddress": "GCEXAMPLE...",
  "email": "user@example.com",
  "organizationId": 456,
  "role": "EMPLOYER",
  "iat": 1672531200,
  "exp": 1672534800
}
```

**Characteristics:**
- Expires in **1 hour**
- Signed with `JWT_SECRET`
- Contains user identity and permissions
- Must be sent with every authenticated request

### Refresh Token

```json
{
  "id": 123,
  "iat": 1672531200,
  "exp": 1673136000
}
```

**Characteristics:**
- Expires in **7 days**
- Signed with `JWT_REFRESH_SECRET`
- Used to obtain new access tokens without re-login
- Should be stored securely (httpOnly cookie or secure storage)

---

## Authentication Flow

### 1. Registration Flow

```
Client                              Backend
  |                                    |
  |-- POST /api/auth/register -------->|
  |    {                               |
  |      email: "user@example.com",    |
  |      password: "SecurePass123!",   |
  |      walletAddress: "GCEXAMPLE",   |
  |      organizationId: 456,          |
  |      role: "EMPLOYER"              |
  |    }                               |
  |                                    |
  |<---- 201 Created ------------------|
  |    {                               |
  |      message: "Registration...",   |
  |      userId: 123                   |
  |    }                               |
  |                                    |
  |-- GET /api/auth/verify-email ----->|
  |    ?token=<verification_token>     |
  |                                    |
  |<---- 200 OK -----------------------|
  |    { message: "Email verified" }   |
```

### 2. Login Flow

```
Client                              Backend
  |                                    |
  |-- POST /api/auth/login ----------->|
  |    {                               |
  |      email: "user@example.com",    |
  |      password: "SecurePass123!"    |
  |    }                               |
  |                                    |
  |<---- 200 OK -----------------------|
  |    {                               |
  |      accessToken: "eyJhbGci...",   |
  |      refreshToken: "eyJhbGci...",  |
  |      expiresIn: 3600,              |
  |      user: {                       |
  |        id: 123,                    |
  |        email: "user@example.com",  |
  |        role: "EMPLOYER"            |
  |      }                             |
  |    }                               |
```

### 3. Authenticated Request Flow

```
Client                              Backend
  |                                    |
  |-- GET /api/payroll -------------->|
  |    Authorization: Bearer <token>   |
  |                                    |
  |              [JWT Middleware]      |
  |              Validates token       |
  |              Decodes payload       |
  |              Sets req.user         |
  |                                    |
  |              [RBAC Middleware]     |
  |              Checks role           |
  |              Checks organization   |
  |                                    |
  |<---- 200 OK -----------------------|
  |    { data: [...] }                 |
```

### 4. Token Refresh Flow

```
Client                              Backend
  |                                    |
  |-- POST /api/auth/refresh -------->|
  |    {                               |
  |      refreshToken: "eyJhbGci..."   |
  |    }                               |
  |                                    |
  |<---- 200 OK -----------------------|
  |    {                               |
  |      accessToken: "eyJhbGci...",   |
  |      expiresIn: 3600               |
  |    }                               |
```

### 5. OAuth 2.0 Social Login Flow

```
Client                   Backend                Google/GitHub
  |                         |                         |
  |-- GET /auth/google ---->|                         |
  |                         |-- Redirect ------------>|
  |<---- 302 Redirect ------|                         |
  |                         |                         |
  |<--------------------------------------------------|
  |        User authorizes on Google                  |
  |-------------------------------------------------->|
  |                         |                         |
  |                         |<-- Callback with code --|
  |                         |                         |
  |                         [Verify & create/link]    |
  |                         |                         |
  |<---- 302 with token ----|                         |
  |    /auth-callback?token=<jwt>                     |
```

---

## API Endpoints

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/auth/register` | Register new user | No |
| `GET` | `/api/auth/verify-email` | Verify email via token | No |
| `POST` | `/api/auth/resend-verification` | Resend verification email | No |
| `POST` | `/api/auth/login` | Login with credentials | No |
| `POST` | `/api/auth/refresh` | Refresh access token | No |
| `POST` | `/api/auth/logout` | Logout (client-side token removal) | No |
| `POST` | `/api/auth/2fa/setup` | Setup 2FA | Yes |
| `POST` | `/api/auth/2fa/verify` | Verify 2FA code | Yes |
| `POST` | `/api/auth/2fa/disable` | Disable 2FA | Yes |
| `POST` | `/api/auth/admin/unlock` | Admin unlock user account | Yes (Admin) |
| `GET` | `/api/auth/google` | Initiate Google OAuth | No |
| `GET` | `/api/auth/google/callback` | Google OAuth callback | No |
| `GET` | `/api/auth/github` | Initiate GitHub OAuth | No |
| `GET` | `/api/auth/github/callback` | GitHub OAuth callback | No |
| `GET` | `/api/auth/social-identities` | List linked social accounts | Yes |
| `DELETE` | `/api/auth/social-identities/:provider` | Unlink social account | Yes |

### Request/Response Examples

#### POST /api/auth/register

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "employer@example.com",
    "password": "SecurePass123!",
    "walletAddress": "GCEXAMPLE...",
    "organizationId": 456,
    "role": "EMPLOYER"
  }'
```

**Response (201 Created):**
```json
{
  "message": "Registration successful. Please verify your email.",
  "userId": 123
}
```

#### POST /api/auth/login

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "employer@example.com",
    "password": "SecurePass123!"
  }'
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "user": {
    "id": 123,
    "email": "employer@example.com",
    "walletAddress": "GCEXAMPLE...",
    "organizationId": 456,
    "role": "EMPLOYER"
  }
}
```

#### POST /api/auth/refresh

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600
}
```

---

## Using Authentication

### In Your Client Application

#### 1. Store Tokens Securely

```typescript
// After successful login
const { accessToken, refreshToken } = response.data;

// Store access token in memory (recommended)
let currentAccessToken = accessToken;

// Store refresh token securely
localStorage.setItem('refreshToken', refreshToken); // Or use httpOnly cookie
```

#### 2. Add Authorization Header

```typescript
// Using fetch
fetch('http://localhost:3000/api/payroll', {
  headers: {
    'Authorization': `Bearer ${currentAccessToken}`,
    'Content-Type': 'application/json'
  }
});

// Using axios
axios.get('http://localhost:3000/api/payroll', {
  headers: {
    'Authorization': `Bearer ${currentAccessToken}`
  }
});
```

#### 3. Handle Token Expiration

```typescript
// Axios interceptor example
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 403) {
      // Token expired, refresh it
      const refreshToken = localStorage.getItem('refreshToken');
      const { data } = await axios.post('/api/auth/refresh', { refreshToken });
      
      currentAccessToken = data.accessToken;
      
      // Retry original request
      error.config.headers['Authorization'] = `Bearer ${currentAccessToken}`;
      return axios.request(error.config);
    }
    return Promise.reject(error);
  }
);
```

---

## Role-Based Access Control (RBAC)

### User Roles

PayD supports two primary roles:

| Role | Description | Permissions |
|------|-------------|-------------|
| `EMPLOYER` | Organization owner/admin | Full access to org payroll, employees, settings |
| `EMPLOYEE` | Organization member | View own payroll data, update wallet address |

### Middleware Usage

#### Require Authentication

```typescript
import { authenticateJWT } from '../middlewares/auth.js';

router.get('/payroll', authenticateJWT, (req, res) => {
  // req.user contains decoded JWT payload
  console.log(req.user.id, req.user.role);
  res.json({ data: [] });
});
```

#### Require Specific Role

```typescript
import { authenticateJWT } from '../middlewares/auth.js';
import { authorizeRoles } from '../middlewares/rbac.js';

router.post('/payroll/create', 
  authenticateJWT, 
  authorizeRoles('EMPLOYER'),
  (req, res) => {
    // Only EMPLOYER can access
    res.json({ success: true });
  }
);
```

#### Isolate by Organization

```typescript
import { authenticateJWT } from '../middlewares/auth.js';
import { isolateOrganization } from '../middlewares/rbac.js';

router.get('/employees', 
  authenticateJWT, 
  isolateOrganization,
  (req, res) => {
    // req.organizationId is set from req.user
    // Verify requested orgId matches user's organization
    const employees = await getEmployees(req.organizationId);
    res.json({ employees });
  }
);
```

#### Require 2FA

```typescript
import { authenticateJWT } from '../middlewares/auth.js';
import { require2fa } from '../middlewares/require2fa.js';

router.post('/wallet/update', 
  authenticateJWT, 
  require2fa,
  (req, res) => {
    // User must have 2FA enabled and verified
    res.json({ success: true });
  }
);
```

---

## Security Best Practices

### Environment Variables

Always configure these in your `.env` file:

```bash
JWT_SECRET=your-very-long-random-secret-key-here
JWT_REFRESH_SECRET=another-different-long-secret-key
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
```

**Generate strong secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Token Security

1. **Use HTTPS in production** - Never send tokens over HTTP
2. **Short access token lifetime** - Default 1 hour limits exposure
3. **Rotate refresh tokens** - Invalidate old tokens on refresh
4. **Validate token signature** - Always verify JWT signature
5. **Don't store sensitive data in JWT** - Tokens are visible to clients

### Rate Limiting

Authentication endpoints are rate-limited to prevent brute-force attacks:

```typescript
// Example: Login endpoint limited to 5 requests per 15 minutes per IP
const loginRateLimit = authRateLimit({
  identifier: (req) => {
    const walletAddress = req.body?.walletAddress?.trim() || '';
    const ip = req.ip || 'unknown';
    return walletAddress ? `login:${ip}:${walletAddress}` : `login:${ip}`;
  },
});
```

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### 2FA (Two-Factor Authentication)

For sensitive operations (wallet updates, admin actions), 2FA is required:

```typescript
POST /api/auth/2fa/setup
{
  "password": "current_password"
}
// Returns QR code and secret
```

---

## Error Handling

### Common Error Responses

#### 401 Unauthorized - Missing Token

```json
{
  "code": "UNAUTHORIZED",
  "message": "Bearer authentication token missing"
}
```

#### 403 Forbidden - Invalid Token

```json
{
  "code": "FORBIDDEN",
  "message": "Invalid or expired token"
}
```

#### 403 Forbidden - Insufficient Permissions

```json
{
  "error": "Access denied: Insufficient permissions"
}
```

#### 403 Forbidden - Organization Mismatch

```json
{
  "error": "Access denied: Organization mismatch"
}
```

#### 429 Too Many Requests - Rate Limit

```json
{
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests, please try again later",
  "retryAfter": 900
}
```

---

## Testing Authentication

### Manual Testing with cURL

#### 1. Register a user

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "walletAddress": "GCTEST...",
    "organizationId": 1,
    "role": "EMPLOYER"
  }'
```

#### 2. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }'
```

Save the `accessToken` from the response.

#### 3. Make authenticated request

```bash
curl -X GET http://localhost:3000/api/payroll \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Automated Testing

```typescript
import request from 'supertest';
import app from '../app';

describe('Authentication', () => {
  let accessToken: string;

  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'Test123!',
        walletAddress: 'GCTEST...',
        organizationId: 1,
        role: 'EMPLOYER'
      });
    
    expect(res.status).toBe(201);
    expect(res.body.userId).toBeDefined();
  });

  it('should login and return tokens', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'Test123!'
      });
    
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    accessToken = res.body.accessToken;
  });

  it('should access protected route with valid token', async () => {
    const res = await request(app)
      .get('/api/payroll')
      .set('Authorization', `Bearer ${accessToken}`);
    
    expect(res.status).toBe(200);
  });

  it('should reject request without token', async () => {
    const res = await request(app)
      .get('/api/payroll');
    
    expect(res.status).toBe(401);
  });
});
```

---

## Related Documentation

- [Rate Limiting](../backend/THROTTLING_README.md)
- [Database Schema](../DB_SCHEMA.md)
- [Environment Setup](../ENVIRONMENT_SETUP.md)
- [API Versioning](./API_VERSIONING.md)

---

## Support

For issues or questions about authentication:
1. Check the [API documentation](../README.md)
2. Review the [troubleshooting guide](../DOCKER_TROUBLESHOOTING.md)
3. Open an issue on GitHub

---

*Last updated: 2026-08-25*
