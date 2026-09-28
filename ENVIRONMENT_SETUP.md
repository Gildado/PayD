# Environment Configuration Guide

This guide explains all environment variables required to run PayD locally and in production.

## Overview

PayD uses environment variables stored in `.env` files for configuration. These files are **never committed to version control** for security reasons.

- **Root `.env`**: Blockchain network settings and frontend routing (no secrets)
- **Backend `.env`**: API credentials, database, email, and secrets (sensitive)

## Quick Start

```bash
# For local development
cp .env.example .env
cd backend
cp .env.example .env
docker-compose up
```

## Configuration Files

### Root Environment (`.env`)

Located at repository root. Contains blockchain network configuration and frontend API URLs.

**File**: `.env.example` (copy to `.env`)

#### Stellar Scaffold Configuration

| Variable               | Purpose                                      | Values                                            | Default       |
| ---------------------- | -------------------------------------------- | ------------------------------------------------- | ------------- |
| `STELLAR_SCAFFOLD_ENV` | Which Stellar SDK environment profile to use | `development`, `staging`, `production`, `testing` | `development` |
| `XDG_CONFIG_HOME`      | Directory for Stellar CLI config and keys    | Relative path (e.g., `.config`) or absolute path  | `.config`     |

**Important**: Add `XDG_CONFIG_HOME` directory to `.gitignore` to prevent accidental key commits.

#### Frontend Stellar Network Configuration

| Variable                            | Purpose                                   | Values                         | Default                              |
| ----------------------------------- | ----------------------------------------- | ------------------------------ | ------------------------------------ |
| `PUBLIC_STELLAR_NETWORK`            | Blockchain network for frontend           | `LOCAL`, `TESTNET`, `MAINNET`  | `LOCAL`                              |
| `PUBLIC_STELLAR_NETWORK_PASSPHRASE` | Network cryptographic identifier          | Network-specific string        | `Standalone Network ; February 2017` |
| `PUBLIC_STELLAR_RPC_URL`            | Soroban RPC endpoint for smart contracts  | Full URL including `/rpc` path | `http://localhost:8000/rpc`          |
| `PUBLIC_STELLAR_HORIZON_URL`        | REST API for ledger data and transactions | Full URL to Horizon endpoint   | `http://localhost:8000`              |

**Network Passphrases**:

```
LOCAL (dev docker):    "Standalone Network ; February 2017"
TESTNET (SDF):         "Test SDF Network ; September 2015"
MAINNET (production):  "Public Global Stellar Network ; September 2015"
```

**Horizon Endpoints**:

```
LOCAL:     http://localhost:8000 (requires: docker-compose up)
TESTNET:   https://horizon-testnet.stellar.org
MAINNET:   https://horizon.stellar.org
```

#### Frontend API Configuration

| Variable            | Purpose                       | Values                                    | Default                 |
| ------------------- | ----------------------------- | ----------------------------------------- | ----------------------- |
| `VITE_API_URL`      | Primary backend API origin    | Full URL (`http://localhost:3000`)        | `http://localhost:3000` |
| `VITE_API_BASE_URL` | Fallback/secondary API origin | Full URL (usually same as `VITE_API_URL`) | `http://localhost:3000` |

**Important**:

- Must match `CORS_ORIGIN` in backend `.env`
- Include protocol and port: `http://localhost:3000` not just `localhost:3000`
- No trailing slash

### Backend Environment (`backend/.env`)

Located in `backend/` directory. Contains sensitive credentials and production database URLs.

**File**: `backend/.env.example` (copy to `backend/.env`)

#### Core Server Runtime

| Variable               | Purpose                                          | Values                                                  | Default                 |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------------- | ----------------------- |
| `PORT`                 | API server listening port                        | `3000`, `3001`, `8000`, etc.                            | `3000`                  |
| `NODE_ENV`             | Application environment level                    | `development`, `production`, `test`                     | `development`           |
| `CORS_ORIGIN`          | Primary allowed origin for cross-origin requests | Full URL matching frontend                              | `http://localhost:5173` |
| `CORS_ALLOWED_ORIGINS` | Additional allowed origins (comma-separated)     | URLs like `https://app.payd.io,https://staging.payd.io` | (optional)              |
| `FRONTEND_URL`         | Base URL for auth redirects                      | Full URL of frontend application                        | `http://localhost:5173` |

#### Authentication & Security (CRITICAL)

| Variable               | Purpose                       | Requirements                                       | Default                                      |
| ---------------------- | ----------------------------- | -------------------------------------------------- | -------------------------------------------- |
| `JWT_SECRET`           | Access token signing secret   | Min 32 characters, random, unique per environment  | (required)                                   |
| `JWT_REFRESH_SECRET`   | Refresh token signing secret  | Min 32 characters, **must differ from JWT_SECRET** | (required)                                   |
| `GOOGLE_CLIENT_ID`     | Google OAuth application ID   | Obtained from Google Cloud Console                 | (optional)                                   |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret           | Never expose publicly                              | (optional)                                   |
| `GOOGLE_CALLBACK_URL`  | OAuth redirect URL for Google | Must match Google Cloud settings                   | `http://localhost:3001/auth/google/callback` |
| `GITHUB_CLIENT_ID`     | GitHub OAuth application ID   | Obtained from GitHub settings                      | (optional)                                   |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth secret           | Never expose publicly                              | (optional)                                   |
| `GITHUB_CALLBACK_URL`  | OAuth redirect URL for GitHub | Must match GitHub OAuth settings                   | `http://localhost:3001/auth/github/callback` |

**Generating Strong Secrets**:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Security Notes**:

- Generate **unique** secrets for each environment
- Rotate JWT secrets regularly in production
- Use AWS Secrets Manager, HashiCorp Vault, or similar for production
- Never log or expose JWT_SECRET or JWT_REFRESH_SECRET

#### Database Configuration

| Variable       | Purpose                           | Example                                | Default                               |
| -------------- | --------------------------------- | -------------------------------------- | ------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string      | `postgresql://user:pass@host:5432/db`  | `postgres://localhost:5432/payd_test` |
| `DB_HOST`      | (Alternative) Database hostname   | `localhost`, `db`, or managed endpoint | `localhost`                           |
| `DB_PORT`      | (Alternative) Database port       | Standard: `5432`                       | `5432`                                |
| `DB_USER`      | (Alternative) Database user       | Username with DDL permissions          | `payd_user`                           |
| `DB_PASSWORD`  | (Alternative) Database password   | Strong random value                    | `payd_password`                       |
| `DB_NAME`      | (Alternative) Database name       | Lowercase with underscores             | `payd_db`                             |
| `REDIS_URL`    | Redis cache connection (optional) | `redis://localhost:6379`               | (optional)                            |

**Note**: Use `DATABASE_URL` in production; `DB_*` variables are kept for backward compatibility.

#### Email Configuration

| Variable             | Purpose                     | Values                            | Default                    |
| -------------------- | --------------------------- | --------------------------------- | -------------------------- |
| `EMAIL_PROVIDER`     | Transactional email service | `resend`, `sendgrid`              | `resend`                   |
| `EMAIL_FROM_ADDRESS` | Sender email address        | Verified email in provider        | `noreply@payd.example.com` |
| `EMAIL_FROM_NAME`    | Sender display name         | Company/app name                  | `PayD Payroll System`      |
| `RESEND_API_KEY`     | Resend service API key      | API key from https://resend.com   | (if using Resend)          |
| `SENDGRID_API_KEY`   | SendGrid service API key    | API key from https://sendgrid.com | (if using SendGrid)        |

**Email Provider Setup**:

- **Resend**: https://resend.com → Get API key → Verify sender email
- **SendGrid**: https://sendgrid.com → Get API key → Verify sender identity

#### Rate Limiting & Throttling

| Variable                        | Purpose                      | Typical Range                             | Default           |
| ------------------------------- | ---------------------------- | ----------------------------------------- | ----------------- |
| `THROTTLING_TPM`                | Contract ops per minute      | `10` (conservative) to `500` (aggressive) | `100`             |
| `THROTTLING_MAX_QUEUE_SIZE`     | Max queued requests size     | `500` to `5000`                           | `1000`            |
| `THROTTLING_REFILL_INTERVAL_MS` | Token refill frequency       | `100` to `2000`                           | `1000`            |
| `RATE_LIMIT_AUTH_WINDOW_MS`     | Auth endpoint time window    | `300000` to `1800000`                     | `900000` (15 min) |
| `RATE_LIMIT_AUTH_MAX`           | Max auth requests per window | `3` to `20`                               | `10`              |
| `RATE_LIMIT_API_WINDOW_MS`      | General API time window      | `60000` (1 min) to `3600000` (1 hour)     | `60000`           |
| `RATE_LIMIT_API_MAX`            | Max API requests per window  | `50` to `500`                             | `100`             |
| `RATE_LIMIT_DATA_WINDOW_MS`     | Data endpoint time window    | `60000` to `3600000`                      | `60000`           |
| `RATE_LIMIT_DATA_MAX`           | Max data requests per window | Can be higher than general API            | `200`             |

**Tuning Strategy**:

- Start low, increase if legitimate users hit limits
- Monitor logs for 429 (Too Many Requests) errors
- Adjust based on actual usage patterns

#### Stellar Network Configuration

| Variable                     | Purpose                           | Values                                        | Default                                      |
| ---------------------------- | --------------------------------- | --------------------------------------------- | -------------------------------------------- |
| `STELLAR_NETWORK`            | Blockchain network                | `testnet`, `mainnet`, `public`                | `testnet`                                    |
| `STELLAR_NETWORK_PASSPHRASE` | Network identifier for signatures | Network-specific string                       | `Test SDF Network ; September 2015`          |
| `STELLAR_HORIZON_URL`        | Horizon API endpoint              | Full URL to Horizon                           | `https://horizon-testnet.stellar.org`        |
| `STELLAR_MAX_RETRIES`        | Transaction retry attempts        | `1` to `5`                                    | `3`                                          |
| `STELLAR_RETRY_DELAY_MS`     | Initial retry delay               | `500` to `2000`                               | `1000`                                       |
| `STELLAR_RETRY_DELAY_MAX_MS` | Maximum retry delay               | `5000` to `30000`                             | `10000`                                      |
| `STELLAR_EXPLORER_URL`       | Transaction explorer link base    | Full URL pattern with `{tx-hash}` placeholder | `https://stellar.expert/explorer/testnet/tx` |

**Network Selection**:

```
TESTNET (development/testing):
  STELLAR_NETWORK=testnet
  STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
  STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org

MAINNET (production):
  STELLAR_NETWORK=mainnet
  STELLAR_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
  STELLAR_HORIZON_URL=https://horizon.stellar.org
```

## Environment Separation

### Local Development (Docker)

```bash
# Root .env
STELLAR_SCAFFOLD_ENV=development
PUBLIC_STELLAR_NETWORK="LOCAL"
PUBLIC_STELLAR_RPC_URL="http://localhost:8000/rpc"
PUBLIC_STELLAR_HORIZON_URL="http://localhost:8000"
VITE_API_URL="http://localhost:3000"

# backend/.env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://payd_user:payd_password@localhost:5432/payd_db
REDIS_URL=redis://localhost:6379
STELLAR_NETWORK=testnet
```

### Staging (Cloud)

```bash
# Root .env
STELLAR_SCAFFOLD_ENV=staging
PUBLIC_STELLAR_NETWORK="TESTNET"
PUBLIC_STELLAR_RPC_URL="https://soroban-testnet-rpc.stellar.org"
PUBLIC_STELLAR_HORIZON_URL="https://horizon-testnet.stellar.org"
VITE_API_URL="https://api-staging.payd.io"

# backend/.env
PORT=3000
NODE_ENV=production
DATABASE_URL=<RDS connection string>
REDIS_URL=<ElastiCache endpoint>
STELLAR_NETWORK=testnet
```

### Production (Mainnet)

```bash
# Root .env
STELLAR_SCAFFOLD_ENV=production
PUBLIC_STELLAR_NETWORK="MAINNET"
PUBLIC_STELLAR_RPC_URL="https://soroban-mainnet-rpc.stellar.org"
PUBLIC_STELLAR_HORIZON_URL="https://horizon.stellar.org"
VITE_API_URL="https://api.payd.io"

# backend/.env
PORT=3000
NODE_ENV=production
DATABASE_URL=<Production RDS connection string>
REDIS_URL=<Production ElastiCache endpoint>
STELLAR_NETWORK=mainnet
```

## Security Best Practices

### Do's ✅

- ✅ Use strong, random values for all secrets (32+ characters)
- ✅ Store `.env` files in a secure secret management system (AWS Secrets Manager, Vault)
- ✅ Add `.env` and `backend/.env` to `.gitignore`
- ✅ Rotate secrets regularly, especially JWT keys
- ✅ Use HTTPS in production for all endpoints
- ✅ Log all secret access attempts
- ✅ Review environment variables in pull requests (show redacted versions)
- ✅ Use different secrets for each environment (development, staging, production)

### Don'ts ❌

- ❌ Never commit `.env` files to version control
- ❌ Never put secrets in `PUBLIC_*` or `VITE_*` variables (they're exposed to frontend)
- ❌ Never use placeholder values like `replace-with-...` in production
- ❌ Never log JWT_SECRET or JWT_REFRESH_SECRET
- ❌ Never share secrets verbally or in unencrypted messages
- ❌ Never hardcode secrets in application code
- ❌ Never use the same secret across multiple environments
- ❌ Never expose secrets in error messages or logs

## Validation

PayD validates all environment variables at startup using Zod schemas. Invalid configurations will fail with clear error messages:

```
Error: JWT_SECRET must be at least 32 characters long
Error: JWT_REFRESH_SECRET must be different from JWT_SECRET
Error: PORT must be a valid number
```

### Running Environment Tests

```bash
cd backend
npm test -- src/config/__tests__/env.test.ts
```

## Troubleshooting

### "PORT is already in use"

- Change PORT to a different value (e.g., 3001, 3002)
- Or kill existing process: `lsof -i :3000`

### "DATABASE_URL: Connection refused"

- Ensure PostgreSQL is running: `docker-compose ps`
- Check DB_HOST, DB_PORT, DB_USER credentials
- Run: `docker-compose up -d db` to start database

### "CORS error: Origin not allowed"

- CORS_ORIGIN must exactly match frontend origin (protocol + host + port)
- Example: `http://localhost:5173` not `localhost:5173`

### "JWT_SECRET validation failed"

- Must be at least 32 characters
- Cannot be a placeholder like `replace-with-...`
- Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### "STELLAR_NETWORK_PASSPHRASE mismatch"

- Ensure passphrase matches the selected STELLAR_NETWORK
- Testnet: `"Test SDF Network ; September 2015"`
- Mainnet: `"Public Global Stellar Network ; September 2015"`

## CI/CD Integration

In CI/CD environments, set environment variables via:

- Platform secrets (GitHub Secrets, GitLab Variables, Azure Key Vault)
- `.env` files provided by deployment tool
- Environment setup scripts

**Example GitHub Actions**:

```yaml
env:
  PORT: 3000
  NODE_ENV: production
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
  JWT_REFRESH_SECRET: ${{ secrets.JWT_REFRESH_SECRET }}
```

## Additional Resources

- [Stellar Network Documentation](https://developers.stellar.org/)
- [Soroban RPC API](https://soroban.stellar.org/)
- [Environment Variables Best Practices](https://12factor.net/config)
- [OWASP: Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
