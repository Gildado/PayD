# Soroban Logic Features (Index)

This index links the major Soroban-related features in PayD across the backend and frontend.

## 1) Soroban Event Indexing (Backend)

- Design + schema + endpoints: `backend/SOROBAN_EVENT_INDEXING.md`
- Indexer implementation: `backend/src/services/sorobanEventIndexer.ts`
- API controller: `backend/src/controllers/contractEventsController.ts`
- Migrations: `backend/src/db/migrations/015_create_contract_events.sql`

## 2) Contract Error Parsing + UI Display (Frontend)

- Error parser: `frontend/src/utils/contractErrorParser.ts`
- Soroban invocation hook: `frontend/src/hooks/useSorobanContract.ts`

## 3) Contract Registry API (Backend + Frontend)

- Implementation notes: `CONTRACT_REGISTRY_IMPLEMENTATION.md`
- Status notes: `CONTRACT_REGISTRY_STATUS.md`
- Backend controller: `backend/src/controllers/contractController.ts`
- Frontend service: `frontend/src/services/contracts.ts`

## 4) Soroban Contract Invocation Hook (Frontend)

- Hook: `frontend/src/hooks/useSorobanContract.ts`
- Example usage: `frontend/src/hooks/usePayrollContracts.ts`

