# Staging Environment: Known Issues & Pitfalls

This document outlines common pitfalls, current limitations, and troubleshooting steps for the PayD staging environment.

## 🚨 Common Pitfalls

### 1. Network Connectivity & Timeouts

The staging environment interacts with the Stellar Testnet. Occasionally, the Stellar RPC nodes or Friendbot (the faucet) may be slow or unresponsive.

- **Symptom**: CI/CD pipeline fails at the "Wait for Stellar Quickstart health" check.
- **Fix**: Re-run the job. If the issue persists, check the [Stellar Dashboard](https://dashboard.stellar.org/) for network status.

### 2. Frontend Dependency Conflicts

The frontend uses several packages with strict peer dependency requirements.

- **Pitfall**: Running `npm install` without flags may fail.
- **Fix**: Always use `npm install --legacy-peer-deps` or `npm ci --legacy-peer-deps` in the frontend directory. This is handled automatically in the GitHub Actions pipeline.

### 3. Environment Variable Mismatches

There is a distinction between `PUBLIC_STELLAR_NETWORK` (used by the frontend/Vite) and `STELLAR_NETWORK` (used by the backend).

- **Pitfall**: Configuring one but not the other, leading to "Network mismatch" errors or connecting to the wrong network.
- **Fix**: Ensure both are set to `testnet` for staging and `mainnet` for production.

### 4. Entry Point Confusion (`index.ts` vs `app.ts`)

The backend codebase has both an `index.ts` (entry point) and an `app.ts` (application logic).

- **Pitfall**: Adding routes to `app.ts` but finding they return 404 because `index.ts` wasn't updated to use the full `app.ts` instance.
- **Fix**: Ensure `index.ts` imports and uses the `app` export from `app.ts`. (A critical fix for this was applied recently).

## ⚠️ Current Limitations

### 1. Asset Trustlines

On Testnet, accounts still need to approve the trustline transaction in their wallet, but the app now prompts for `ORGUSD` trustline setup during onboarding.

- **Status**: Automated prompting is now available; manual wallet approval is still required.

### 2. Rate Limiting

The backend implementation includes transaction throttling to prevent spam.

- **Limit**: Currently set to 10 requests per minute per IP for sensitive endpoints.
- **Impact**: Rapid testing may trigger 429 Too Many Requests.

## 🔍 Troubleshooting

- **404 Not Found on API**: Check `backend/src/index.ts` to ensure it's using the correct router.
- **Contract Address Issues**: Verify `environments.toml` has the correct contract IDs for the `testnet` network.
- **CORS Errors**: Ensure the staging frontend domain is added to the backend's allowed origins.

---

For more details on specific implementations, see:
- [Contract Registry API](docs/CONTRACT_REGISTRY_API.md)
- [Deployment Guide](docs/DEPLOYMENT_GUIDE_VERCEL_RENDER.md)
- [Transaction Throttling Summary](TRANSACTION_THROTTLING_SUMMARY.md)
