# PayD — Local Development Setup Guide

This guide walks you through setting up a complete PayD development environment on your local machine from scratch.

---

## Prerequisites

Make sure you have the following installed before starting:

| Tool | Minimum Version | Check |
|------|----------------|-------|
| **Node.js** | 20+ | `node --version` |
| **npm** | 9+ | `npm --version` |
| **PostgreSQL** | 14+ | `psql --version` |
| **Git** | 2.30+ | `git --version` |
| **Docker** *(optional)* | 20+ | `docker --version` |

> **macOS shortcut**: Install Node.js via `brew install node` and PostgreSQL via `brew install postgresql@16`  
> **Windows**: Use [nvm-windows](https://github.com/coreybutler/nvm-windows) for Node.js and the [PostgreSQL installer](https://www.postgresql.org/download/windows/)

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/Gildado/PayD.git
cd PayD
```

---

## Step 2 — Configure Environment Variables

### Root environment
```bash
cp .env.example .env
```

### Backend environment
```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in the required values:

```env
# Database (required)
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/payd_dev

# JWT (required — use a long random string)
JWT_SECRET=your-long-random-secret-here

# Stellar Network
STELLAR_NETWORK=TESTNET
HORIZON_URL=https://horizon-testnet.stellar.org

# Port
PORT=3001
NODE_ENV=development
```

> **Tip**: Generate a strong JWT secret with `openssl rand -hex 64`

---

## Step 3 — Set Up the Database

### Option A — Local PostgreSQL

```bash
# Start PostgreSQL (macOS with Homebrew)
brew services start postgresql@16

# Create the database
createdb payd_dev

# Run migrations
cd backend
npm run db:migrate
```

### Option B — Docker

```bash
docker run -d \
  --name payd-postgres \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=payd_dev \
  -p 5432:5432 \
  postgres:16

cd backend
npm run db:migrate
```

---

## Step 4 — Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies (from repo root)
cd ..
npm install
```

---

## Step 5 — Seed the Database (Optional)

Populate the database with sample data for development:

```bash
cd backend
npm run db:seed
```

This creates:
- A sample organization
- An employer account (`employer@payd.dev` / `password123`)
- A few sample employees

---

## Step 6 — Start the Development Servers

### Backend (Express API)
```bash
cd backend
npm run dev
```
The API will be available at **http://localhost:3001**

### Frontend (Vite + React)
```bash
# From the repo root
npm run dev
```
The UI will be available at **http://localhost:5173**

> **Run both at once** using two terminals, or install `concurrently`:
> ```bash
> npm install -g concurrently
> concurrently "cd backend && npm run dev" "npm run dev"
> ```

---

## Step 7 — Verify Everything is Working

### Health check
```bash
curl http://localhost:3001/health
# Expected: {"status":"ok","database":"connected"}
```

### API documentation
Open [http://localhost:3001/api-docs](http://localhost:3001/api-docs) in your browser to explore the Swagger UI.

### Run the test suite
```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd ..
npm test
```

---

## Step 8 — Connect to Stellar Testnet

PayD uses the Stellar testnet for development. You need a funded testnet account:

1. Generate a keypair: visit [https://laboratory.stellar.org/#account-creator](https://laboratory.stellar.org/#account-creator)
2. Click **Generate keypair** and save your **Secret Key**
3. Click **Fund account using friendbot** to get free testnet XLM
4. Add to `backend/.env`:
   ```env
   STELLAR_SECRET_KEY=SXXXXXXXXXXXXX...
   ```

---

## Common Issues

### `ECONNREFUSED` on port 5432
PostgreSQL is not running. Start it:
```bash
# macOS
brew services start postgresql@16

# Ubuntu/Debian
sudo systemctl start postgresql

# Docker
docker start payd-postgres
```

### `invalid_grant` or JWT errors
Regenerate your JWT secret:
```bash
openssl rand -hex 64
```
Update `JWT_SECRET` in `backend/.env` and restart the server.

### Migration errors (`relation does not exist`)
Run migrations again:
```bash
cd backend
npm run db:migrate
```

### Port already in use
Change the port in `backend/.env`:
```env
PORT=3002
```

### Stellar transaction errors
Make sure your testnet account is funded. Visit the friendbot URL:
```
https://friendbot.stellar.org?addr=YOUR_PUBLIC_KEY
```

---

## Project Structure

```
PayD/
├── backend/               # Node.js / Express / Prisma API
│   ├── src/
│   │   ├── controllers/   # Route handlers
│   │   ├── services/      # Business logic
│   │   ├── middlewares/   # Auth, rate limiting, IP whitelist
│   │   ├── routes/        # Express routers
│   │   └── config/        # Database, env, Swagger
│   └── .env.example       # Backend environment template
├── frontend/              # React + Vite frontend
│   └── src/
├── src/                   # Shared frontend source
└── .env.example           # Root environment template
```

---

## Useful Commands

| Command | Description |
|---------|-------------|
| `cd backend && npm run dev` | Start the API server with hot reload |
| `npm run dev` (root) | Start the Vite frontend dev server |
| `cd backend && npm test` | Run backend test suite |
| `cd backend && npm run db:migrate` | Run database migrations |
| `cd backend && npm run db:seed` | Seed sample data |
| `cd backend && npm run build` | Build backend for production |
| `npm run build` (root) | Build frontend for production |

---

## Getting Help

- Read the [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines
- Check [ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md) for system design
- Open a [GitHub Issue](https://github.com/Gildado/PayD/issues) if you're stuck
