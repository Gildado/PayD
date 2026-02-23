# Backend & Indexer Issues — PayD ⚙️

This document tracks the off-chain infrastructure tasks for the **PayD** protocol.

### 🛑 STRICT RULE FOR CONTRIBUTORS
**When you complete an issue:**
1. Mark the checkbox `[x]`
2. Append your GitHub username and the Date/Time.
3. **Example:** `- [x] Setup Postgres Schema (@yourname - 2026-02-18 15:00 UTC)`

---

## 🏗️ Phase 1: Infrastructure Core (BK-1 to BK-4)

### Issue #BK-1: API Shell & Database Setup
**Category:** `[INFRA]`
**Status:** ❌ PENDING
**Priority:** Critical
**Description:** Bootstrap the backend service that indexes events and serves analytics.
- **Tasks:**
  - [ ] Initialize Python (FastAPI) or Node.js (NestJS/Express) project.
  - [ ] Setup PostgreSQL database with Docker Compose.
  - [ ] Design DB schema:
    - `organizations` table (admin, name, created_at)
    - `treasury_events` table (type, amount, token, tx_hash, timestamp)
    - `streams` table (sender, recipient, amount, status, timestamps)
    - `vesting_schedules` table (grantor, beneficiary, amounts, status)
    - `proposals` table (proposer, title, amount, status, votes)
  - [ ] Create database migrations.
  - [ ] Setup health check endpoint `GET /health`.

### Issue #BK-2: Soroban Event Indexer
**Category:** `[INFRA]`
**Status:** ❌ PENDING
**Priority:** High
**Description:** A service that listens to Stellar network events and syncs them to the database.
- **Tasks:**
  - [ ] Implement Soroban-RPC polling using `getEvents` endpoint.
  - [ ] Filter for events from all 4 PayD contracts.
  - [ ] Parse XDR event data into structured form.
  - [ ] Upsert parsed events to PostgreSQL.
  - [ ] Handle cursor persistence for restart recovery.
  - [ ] Add retry logic for transient RPC failures.

### Issue #BK-3: Redis Caching Layer
**Category:** `[INFRA]`
**Status:** ❌ PENDING
**Priority:** Medium
**Description:** Add Redis caching for frequently queried data.
- **Tasks:**
  - [ ] Setup Redis with Docker Compose.
  - [ ] Cache treasury balance queries (60s TTL).
  - [ ] Cache stream claimable amounts (30s TTL).
  - [ ] Cache proposal vote counts (30s TTL).
  - [ ] Implement cache invalidation on new events.

### Issue #BK-4: Docker Compose Full Stack
**Category:** `[INFRA]`
**Status:** ❌ PENDING
**Priority:** Medium
**Description:** Create a Docker Compose setup for the entire backend stack.
- **Tasks:**
  - [ ] `docker-compose.yml` with: API, Indexer, PostgreSQL, Redis.
  - [ ] Environment variable configuration (`.env.example`).
  - [ ] Volume mounts for persistent data.
  - [ ] Health checks for all services.
  - [ ] Add `README` for backend setup instructions.

---

## 📊 Phase 2: Analytics API (BK-5 to BK-7)

### Issue #BK-5: Payment History API
**Category:** `[API]`
**Status:** ❌ PENDING
**Priority:** High
**Description:** Expose endpoints for payment history queries.
- **Tasks:**
  - [ ] `GET /api/streams?sender={addr}` — list streams by sender.
  - [ ] `GET /api/streams?recipient={addr}` — list streams by recipient.
  - [ ] `GET /api/streams/{id}` — stream detail with claim history.
  - [ ] `GET /api/treasury/{addr}/events` — treasury event log.
  - [ ] Pagination support via `cursor` parameter.
  - [ ] Response DTOs with proper serialization.

### Issue #BK-6: Vesting & Governance API
**Category:** `[API]`
**Status:** ❌ PENDING
**Priority:** Medium
**Description:** Expose endpoints for vesting schedules and governance proposals.
- **Tasks:**
  - [ ] `GET /api/vesting?beneficiary={addr}` — list vesting schedules.
  - [ ] `GET /api/vesting/{id}/progress` — vesting progress snapshot.
  - [ ] `GET /api/proposals` — list all proposals.
  - [ ] `GET /api/proposals/{id}` — proposal detail with vote records.
  - [ ] `GET /api/proposals/{id}/votes` — paginated vote list.

### Issue #BK-7: Dashboard Analytics Endpoint
**Category:** `[API]`
**Status:** ❌ PENDING
**Priority:** Low
**Description:** Aggregate analytics for the org dashboard.
- **Tasks:**
  - [ ] `GET /api/analytics/payroll` — total disbursed, active streams, burn rate.
  - [ ] `GET /api/analytics/treasury` — balance over time, deposit/withdrawal volume.
  - [ ] `GET /api/analytics/vesting` — total vesting value, upcoming cliffs.
  - [ ] Return data in chart-friendly format (time series).

---

## 🔒 Phase 3: Security & Monitoring (BK-8 to BK-10)

### Issue #BK-8: API Rate Limiting
**Category:** `[SECURITY]`
**Status:** ❌ PENDING
**Priority:** Medium
- **Tasks:**
  - [ ] Implement rate limiting middleware (100 req/min per IP).
  - [ ] Add exponential backoff for repeated violations.
  - [ ] Return `429 Too Many Requests` with retry-after header.

### Issue #BK-9: API Key Authentication
**Category:** `[SECURITY]`
**Status:** ❌ PENDING
**Priority:** Medium
- **Tasks:**
  - [ ] Implement API key authentication for protected endpoints.
  - [ ] API key generation and management.
  - [ ] Key rotation support.
  - [ ] Separate read-only vs read-write API keys.

### Issue #BK-10: Monitoring & Alerting
**Category:** `[INFRA]`
**Status:** ❌ PENDING
**Priority:** Low
- **Tasks:**
  - [ ] Setup structured logging (JSON format).
  - [ ] Add Prometheus metrics endpoint.
  - [ ] Monitor indexer lag (time since last processed event).
  - [ ] Alert on indexer failure or DB connection issues.
  - [ ] Add Grafana dashboard template.

---

## ✅ Completed Issues
*(Move completed items here)*
