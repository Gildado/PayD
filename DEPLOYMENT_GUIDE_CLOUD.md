# PayD Cloud Deployment Guide

Step-by-step instructions for deploying PayD to **Vercel** (frontend) and **Render** (backend + database).

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Generate Secure Secrets](#generate-secure-secrets)
4. [Deploy the Backend to Render](#deploy-the-backend-to-render)
5. [Deploy the Frontend to Vercel](#deploy-the-frontend-to-vercel)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Environment Variables Reference](#environment-variables-reference)
8. [JWT Secret Rotation](#jwt-secret-rotation)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
Browser
  └── Vercel (frontend: React/Vite)
        └── Render Web Service (backend: Node.js/Express)
              ├── Render PostgreSQL (database)
              └── Render Redis (optional cache/sessions)
```

---

## Prerequisites

- A [GitHub](https://github.com) account with the PayD repository forked or cloned
- A [Render](https://render.com) account (free tier works for staging)
- A [Vercel](https://vercel.com) account (free tier works for staging)
- Node.js ≥ 18 installed locally for generating secrets

---

## Generate Secure Secrets

**Never** skip this step. The server will refuse to start with placeholder values.

```bash
# Generate JWT_SECRET (copy the output)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# Generate JWT_REFRESH_SECRET (must be DIFFERENT from JWT_SECRET)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Save both values in a password manager. You will paste them into Render's environment settings.

---

## Deploy the Backend to Render

### Step 1 – Create a PostgreSQL Database

1. Log in to [dashboard.render.com](https://dashboard.render.com).
2. Click **New → PostgreSQL**.
3. Fill in:
   - **Name**: `payd-db` (or any identifier)
   - **Region**: choose the region closest to your users
   - **Plan**: Free (staging) or Starter (production)
4. Click **Create Database**.
5. On the database page, copy the **Internal Database URL** — you will use it as `DATABASE_URL` later.

### Step 2 – Create a Redis Instance (Optional)

1. Click **New → Redis**.
2. Fill in:
   - **Name**: `payd-redis`
   - **Region**: same as the database
3. Click **Create Redis**.
4. Copy the **Internal Redis URL** — you will use it as `REDIS_URL`.

### Step 3 – Create the Web Service

1. Click **New → Web Service**.
2. Connect your GitHub repository when prompted.
3. Configure the service:
   - **Name**: `payd-backend`
   - **Region**: same as the database
   - **Branch**: `main` (or your production branch)
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**:
     ```
     npm ci && npm run build
     ```
   - **Start Command**:
     ```
     node dist/index.js
     ```
   - **Plan**: Free (staging) or Starter (production)

### Step 4 – Add Environment Variables

In the Render web service settings → **Environment**, add the following key/value pairs:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DATABASE_URL` | *(internal URL from Step 1)* |
| `REDIS_URL` | *(internal URL from Step 2, or leave empty)* |
| `JWT_SECRET` | *(48-byte hex secret from [Generate Secrets](#generate-secure-secrets))* |
| `JWT_REFRESH_SECRET` | *(different 48-byte hex secret)* |
| `CORS_ORIGIN` | `https://your-app.vercel.app` *(update after Vercel deploy)* |
| `FRONTEND_URL` | `https://your-app.vercel.app` |
| `EMAIL_PROVIDER` | `resend` or `sendgrid` |
| `RESEND_API_KEY` | *(from resend.com, if using Resend)* |
| `STELLAR_NETWORK` | `mainnet` (production) or `testnet` (staging) |

> **Tip**: Use Render's **Secret Files** or the built-in environment group feature to share variables across services and avoid repetition.

### Step 5 – Run Database Migrations

Render can run a one-off command after each deploy. In **Settings → Deploy Hook** or use the **Shell** tab:

```bash
npm run migrate
```

Alternatively, set a **Pre-Deploy Command** (Render paid plans):

```
npm run migrate
```

### Step 6 – Deploy

Click **Deploy latest commit** (or push to the branch). Render streams build logs in real time. A successful deploy shows `Your service is live 🎉`.

Note the public URL (e.g., `https://payd-backend.onrender.com`).

---

## Deploy the Frontend to Vercel

### Step 1 – Import the Repository

1. Log in to [vercel.com](https://vercel.com).
2. Click **Add New → Project**.
3. Choose the GitHub repository containing PayD.
4. Select the `frontend` folder as the **Root Directory** (or leave empty if it is the repo root).

### Step 2 – Configure Build Settings

Vercel auto-detects Vite/React. Verify:

- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm ci`

### Step 3 – Add Environment Variables

In the Vercel project → **Settings → Environment Variables**, add:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://payd-backend.onrender.com/api/v1` |
| `VITE_APP_ENV` | `production` |

> Vercel only exposes variables prefixed with `VITE_` to the browser bundle.

### Step 4 – Deploy

Click **Deploy**. Vercel builds and deploys within 1–2 minutes.

Note the production URL (e.g., `https://payd.vercel.app`).

### Step 5 – Update CORS on Render

Go back to the Render backend service → **Environment** and update:

- `CORS_ORIGIN` → `https://payd.vercel.app`
- `FRONTEND_URL` → `https://payd.vercel.app`

Trigger a redeploy on Render (Manual Deploy → Deploy Latest Commit).

---

## Post-Deployment Verification

Run the following checks after each deployment:

```bash
# 1. Health check
curl https://payd-backend.onrender.com/health

# Expected response:
# { "status": "ok", ... }

# 2. API root
curl https://payd-backend.onrender.com/api

# 3. Test CORS (replace origin with your Vercel URL)
curl -H "Origin: https://payd.vercel.app" \
     -I https://payd-backend.onrender.com/api/health
# Check: Access-Control-Allow-Origin header matches your Vercel URL

# 4. Verify JWT auth rejects bad tokens
curl -H "Authorization: Bearer invalid-token" \
     https://payd-backend.onrender.com/api/v1/employees
# Expected: 403 { "code": "FORBIDDEN", "message": "Invalid or expired token", "details": [] }
```

---

## Environment Variables Reference

See [backend/.env.example](../backend/.env.example) for the full annotated list of every supported variable with descriptions, defaults, and security notes.

### Minimum Required Variables for Production

```
NODE_ENV=production
PORT=3000
DATABASE_URL=<postgres connection string>
JWT_SECRET=<48+ char random hex>
JWT_REFRESH_SECRET=<48+ char random hex, different from JWT_SECRET>
CORS_ORIGIN=<frontend URL>
FRONTEND_URL=<frontend URL>
```

---

## JWT Secret Rotation

Rotating JWT secrets invalidates all currently issued tokens. Plan rotations during low-traffic windows.

### Steps

1. **Generate new secrets** (see [Generate Secure Secrets](#generate-secure-secrets)).
2. **Update environment variables** in Render with the new values.
3. **Redeploy** the backend service.
4. **Notify users**: all existing sessions will be invalidated; users must log in again.
5. **Verify**: confirm `POST /api/auth/login` issues tokens signed with the new secret.

### Zero-Downtime Rotation (Advanced)

For production systems that cannot tolerate forced logouts:

1. Add a `JWT_SECRET_PREVIOUS` environment variable containing the old secret.
2. Update the JWT verification middleware to try the new secret first, then fall back to the previous secret.
3. After all tokens issued under the old secret have expired (e.g., after 1 hour), remove `JWT_SECRET_PREVIOUS`.

---

## Troubleshooting

### Backend fails to start with "JWT_SECRET must be replaced with a strong random value"

The application enforces at startup that `JWT_SECRET` and `JWT_REFRESH_SECRET` are not placeholder values. Generate fresh secrets using the command in [Generate Secure Secrets](#generate-secure-secrets) and update the Render environment variables.

### CORS errors in the browser console

1. Confirm `CORS_ORIGIN` in Render exactly matches the Vercel URL (no trailing slash, correct protocol).
2. Redeploy the backend after changing environment variables.
3. Clear browser cache and retry.

### Database connection refused

- Ensure `DATABASE_URL` uses the **Internal** database URL from Render (not the external URL).
- Verify the database and web service are in the **same Render region**.
- Check Render's database logs for connection pool exhaustion.

### Render free-tier sleep

The Render free tier spins down web services after 15 minutes of inactivity. The first request after sleep takes ~30 seconds. Upgrade to a paid plan or use an uptime monitoring service (e.g., UptimeRobot) to send a ping every 10 minutes.

### Vercel build fails — "VITE_API_URL is not defined"

Add `VITE_API_URL` to Vercel's environment variables under **Settings → Environment Variables** and redeploy.
