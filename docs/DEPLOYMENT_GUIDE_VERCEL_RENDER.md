# Deployment Guide: Vercel + Render

This guide covers a production-style deployment split:

- Frontend on Vercel
- Backend API + worker on Render
- PostgreSQL and Redis on Render managed services

## 1. Prerequisites

- GitHub repository with admin access
- Vercel account
- Render account
- Production Stellar/Horizon configuration
- DNS access for your custom domains

## 2. Architecture

- Vercel serves the frontend static bundle
- Render runs the Node/Express backend as a web service
- Render runs payroll/notification workers as background workers
- Render PostgreSQL stores app data
- Render Redis supports queues and caching

## 3. Prepare Environment Variables

Create production environment values before deployment.

### Frontend (Vercel)

- VITE_API_BASE_URL: public URL of the Render backend API
- VITE_STELLAR_NETWORK: testnet or mainnet
- VITE_HORIZON_URL: Horizon URL matching network

### Backend (Render)

- NODE_ENV=production
- PORT=10000
- DATABASE_URL=Render PostgreSQL connection string
- REDIS_URL=Render Redis connection string
- JWT_SECRET=long random secret (32+ chars)
- JWT_REFRESH_SECRET=different long random secret (32+ chars)
- STELLAR_NETWORK=testnet or mainnet
- STELLAR_HORIZON_URL=network horizon endpoint
- STELLAR_SECRET_KEY=secure issuer/distribution key
- Optional provider keys (email, webhooks, OAuth)

Rotate JWT secrets by updating the Render environment variables and redeploying all backend services that verify or mint tokens.

## 4. Deploy Backend on Render

1. Create a new Render Web Service from your GitHub repo.
2. Set root directory to backend.
3. Build command:

```bash
npm install && npm run build
```

4. Start command:

```bash
npm start
```

5. Add backend environment variables from the list above.
6. Attach managed PostgreSQL and Redis instances.
7. Enable health check endpoint (for example `/health`).
8. Deploy and verify API returns healthy responses.

## 5. Deploy Workers on Render

If queues are enabled, create worker services from the same repo and backend root.

1. Create Render Background Worker services.
2. Reuse backend environment variables.
3. Use worker-specific start commands, for example:

```bash
npm run dev
```

4. Confirm workers connect to Redis and process jobs without errors.

## 6. Deploy Frontend on Vercel

1. Import the GitHub repository into Vercel.
2. Configure project settings:

- Framework preset: Vite
- Root directory: frontend (or repo root if frontend is the main app)
- Build command: npm run build
- Output directory: dist

3. Add Vercel frontend environment variables.
4. Set Production branch to main.
5. Deploy and verify UI loads with API connectivity.

## 7. Domain and HTTPS Setup

1. Add custom domains in Vercel and Render.
2. Update DNS records as instructed by each provider.
3. Wait for TLS certificates to be issued automatically.
4. Update CORS allowlist in backend to include frontend domain.

## 8. CI/CD Recommendations

- Enable automatic deploys from main branch for both platforms.
- Add preview deployments for pull requests.
- Gate merge with tests and lint checks.
- Use required reviewers for infrastructure-sensitive changes.

## 9. Post-Deploy Validation Checklist

- Frontend page loads and authenticates
- Backend health endpoint returns success
- Database migrations run successfully
- Redis queue is connected
- Payroll job can be queued and completed
- Notification flow executes for successful transactions
- Error logging and monitoring are active

## 10. Rollback Strategy

- Vercel: Promote previous successful deployment from dashboard
- Render: Roll back to previous deploy in service history
- If schema changed, use backward-compatible migrations to avoid data loss

## 11. Security Notes

- Do not commit production secrets
- Rotate JWT and Stellar secrets on a schedule
- Restrict service-to-service network access where possible
- Enable audit logging for admin actions
