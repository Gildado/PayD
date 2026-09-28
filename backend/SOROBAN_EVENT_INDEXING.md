# Soroban Event Indexing Implementation

This document describes the implementation of a background service that streams Soroban contract events from the Stellar RPC and persists them to PostgreSQL for reliable querying.

## Overview

The Soroban Event Indexer provides:
- Background polling of Stellar blockchain for contract events
- Persistent storage of events in PostgreSQL with deduplication
- REST API endpoints for querying events with pagination
- Graceful restart from the last indexed ledger sequence
- Configurable target contracts and polling intervals

## Architecture

### Components

1. **SorobanEventIndexer** (`backend/src/services/sorobanEventIndexer.ts`)
   - Background service that polls Stellar Horizon API
   - Extracts events from contract invocations
   - Stores events in PostgreSQL with idempotent handling
   - Tracks last indexed ledger sequence for graceful restart

2. **ContractEventsController** (`backend/src/controllers/contractEventsController.ts`)
   - REST API endpoints for querying stored events
   - Pagination support with configurable limits
   - Search and filtering capabilities
   - Event statistics and indexer status

3. **Database Schema**
   - `contract_events` table stores individual events
   - `contract_event_index_state` table tracks indexing progress
   - Unique constraints prevent duplicate events

## Database Schema

### contract_events table
```sql
CREATE TABLE IF NOT EXISTS contract_events (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ledger_sequence BIGINT NOT NULL,
  tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_contract_events_event_id
  ON contract_events (event_id, contract_id);

CREATE INDEX IF NOT EXISTS idx_contract_events_contract_ledger
  ON contract_events (contract_id, ledger_sequence DESC);
```

### contract_event_index_state table
```sql
CREATE TABLE IF NOT EXISTS contract_event_index_state (
  id BIGSERIAL PRIMARY KEY,
  state_key TEXT NOT NULL UNIQUE,
  last_ledger_sequence BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## API Endpoints

### GET /api/events/:contractId
Get paginated events for a specific contract.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `eventType` (optional): Filter by event type
- `category` (optional): Filter by category

**Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### GET /api/events/:contractId/stats
Get event statistics for a specific contract.

**Response:**
```json
{
  "success": true,
  "data": {
    "contract": {
      "id": "contract_id",
      "total_events": 100,
      "first_ledger": 1000,
      "latest_ledger": 2000
    },
    "eventTypes": [...]
  }
}
```

### GET /api/events/:contractId/search
Search events within a contract with advanced filters.

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `query` (optional): Search in payload text
- `eventType` (optional): Filter by event type
- `ledgerFrom` (optional): Starting ledger sequence
- `ledgerTo` (optional): Ending ledger sequence

### GET /api/events/indexer/status
Get the status of the Soroban event indexer.

**Response:**
```json
{
  "success": true,
  "data": {
    "indexer": {
      "isRunning": true,
      "lastIndexedLedger": 1500,
      "lastUpdated": "2024-01-01T00:00:00Z",
      "latestStellarLedger": 1505
    }
  }
}
```

## Configuration

### Environment Variables

```bash
# Enable/disable the indexer
SOROBAN_INDEXER_ENABLE=true

# Polling delay in milliseconds (default: 10000)
SOROBAN_INDEXER_POLL_DELAY=10000

# Batch size for ledger processing (default: 50)
SOROBAN_INDEXER_BATCH_SIZE=50

# Comma-separated list of contract IDs to index
# Empty string means index all contracts
SOROBAN_TARGET_CONTRACTS=contract1,contract2,contract3
```

## Features

### Idempotent Event Handling
- Events are uniquely identified by `event_id` and `contract_id`
- `ON CONFLICT DO NOTHING` prevents duplicate storage
- Safe to restart indexer multiple times

### Graceful Restart
- Indexer tracks last processed ledger sequence
- On restart, continues from where it left off
- No data loss or duplication

### Error Handling
- Comprehensive logging for debugging
- Graceful handling of API failures
- Continues processing individual ledgers even if others fail

### Performance Optimization
- Batch processing of ledgers
- Configurable polling intervals
- Database connection pooling
- Indexed database queries

## Usage

### Starting the Indexer

The indexer starts automatically when the backend starts if `SOROBAN_INDEXER_ENABLE=true`.

```bash
npm run dev
```

### Querying Events

```bash
# Get all events for a contract
curl "http://localhost:3001/api/events/CONTRACT_ID"

# Get paginated events
curl "http://localhost:3001/api/events/CONTRACT_ID?page=2&limit=10"

# Search events
curl "http://localhost:3001/api/events/CONTRACT_ID/search?query=payment&eventType=transfer"

# Get indexer status
curl "http://localhost:3001/api/events/indexer/status"
```

## Target Contracts

The indexer can be configured to track specific contracts:

1. **bulk_payment**: Handles bulk payment operations
2. **vesting_escrow**: Manages vesting schedules
3. **revenue_split**: Distributes revenue among stakeholders

Set the contract IDs in `SOROBAN_TARGET_CONTRACTS` environment variable:

```bash
SOROBAN_TARGET_CONTRACTS=CB7N...XYZ,ABC1...123,DEF2...456
```

## Monitoring

### Logs
The indexer logs detailed information about:
- Ledger processing progress
- Event extraction and storage
- Errors and warnings
- Performance metrics

### Database Queries
Monitor indexing progress:

```sql
-- Get latest indexed ledger
SELECT last_ledger_sequence, updated_at 
FROM contract_event_index_state 
WHERE state_key = 'soroban_events';

-- Count events by contract
SELECT contract_id, COUNT(*) as event_count
FROM contract_events
GROUP BY contract_id
ORDER BY event_count DESC;
```

## Troubleshooting

### Common Issues

1. **Indexer not starting**
   - Check `SOROBAN_INDEXER_ENABLE=true`
   - Verify database connection
   - Check logs for errors

2. **Missing events**
   - Verify contract IDs in `SOROBAN_TARGET_CONTRACTS`
   - Check if contracts are emitting events
   - Review indexer logs

3. **Performance issues**
   - Increase `SOROBAN_INDEXER_POLL_DELAY`
   - Reduce `SOROBAN_INDEXER_BATCH_SIZE`
   - Check database performance

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm run dev
```

## Future Enhancements

1. **Real-time streaming**: Replace polling with WebSocket connections
2. **Event filtering**: Client-side filtering for specific event types
3. **Archival**: Move old events to cold storage
4. **Analytics**: Event aggregation and reporting
5. **Multi-network support**: Index events from multiple Stellar networks

## Security Considerations

- Database connections use connection pooling
- API endpoints have rate limiting
- Input validation on all parameters
- No sensitive data in event payloads
- Secure handling of contract IDs
