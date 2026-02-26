# Implementation Plan: Contract Address Registry API

## Overview

This implementation plan breaks down the Contract Address Registry API feature into discrete coding tasks. The feature consists of a backend REST API that serves contract deployment information from configuration sources (environments.toml or environment variables) and a frontend service that fetches, caches, and provides type-safe access to contract addresses.

The implementation follows a bottom-up approach: building core utilities first, then services, then controllers, and finally integration. Testing tasks are included as optional sub-tasks to enable faster MVP delivery while maintaining quality standards.

## Tasks

- [x] 1. Set up project structure and dependencies
  - Create backend directory structure: `backend/src/services/`, `backend/src/controllers/`, `backend/src/routes/`, `backend/src/utils/`, `backend/src/__tests__/`
  - Create frontend directory structure: `frontend/src/services/`, `frontend/src/services/__tests__/`
  - Install backend dependencies: express, @types/express, toml, winston, morgan, cors, @types/cors
  - Install testing dependencies: jest, @types/jest, fast-check, supertest, @types/supertest
  - Install frontend dependencies: axios
  - _Requirements: 1.1, 3.1, 4.1_

- [x] 2. Implement backend contract validator
  - [x] 2.1 Create contract validator utility
    - Create `backend/src/utils/contractValidator.ts`
    - Implement validation function for Stellar contract address format (C + 56 alphanumeric chars)
    - Implement validation for required fields (contractId, network, contractType, version, deployedAt)
    - Implement validation for network values (testnet/mainnet)
    - Implement validation for deployedAt as positive integer
    - Return validation result with descriptive error messages
    - _Requirements: 3.7, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]\* 2.2 Write unit tests for contract validator
    - Test valid Stellar contract address passes validation
    - Test invalid format (wrong prefix) fails validation
    - Test invalid format (wrong length) fails validation
    - Test missing required fields fails validation
    - Test invalid network value fails validation
    - Test invalid deployedAt value fails validation
    - _Requirements: 10.3_

  - [ ]\* 2.3 Write property test for contract ID validation
    - **Property 4: Contract ID Format Validation**
    - **Validates: Requirements 3.7**
    - Generate random contract IDs (valid and invalid patterns)
    - Verify valid ones pass, invalid ones fail
    - Verify format enforcement: C + 56 alphanumeric chars
    - Run minimum 100 iterations
    - _Requirements: 3.7_

- [x] 3. Implement backend configuration parser service
  - [x] 3.1 Create configuration service for TOML parsing
    - Create `backend/src/services/contractConfigService.ts`
    - Implement parseTomlConfig() method to read and parse environments.toml
    - Extract contracts from [staging.contracts] section and map to testnet
    - Extract contracts from [production.contracts] section and map to mainnet
    - Map TOML structure to ContractEntry interface
    - Handle file not found errors gracefully
    - _Requirements: 3.1, 3.6_

  - [x] 3.2 Add environment variable fallback parsing
    - Implement parseEnvVarConfig() method
    - Parse {CONTRACT*TYPE}*{NETWORK}\_CONTRACT_ID pattern
    - Parse {CONTRACT*TYPE}*{NETWORK}\_VERSION pattern
    - Parse {CONTRACT*TYPE}*{NETWORK}\_DEPLOYED_AT pattern
    - Map environment variables to ContractEntry interface
    - Support all contract types: bulk_payment, vesting_escrow, revenue_split, cross_asset_payment
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

  - [x] 3.3 Implement getContractEntries() orchestration method
    - Try parseTomlConfig() first
    - Fall back to parseEnvVarConfig() if TOML unavailable
    - Return empty array if both sources unavailable
    - Log configuration source used (INFO level)
    - _Requirements: 3.1, 3.2, 5.3_

  - [ ]\* 3.4 Write unit tests for configuration service
    - Test parsing valid environments.toml with staging contracts
    - Test parsing valid environments.toml with production contracts
    - Test fallback to env vars when TOML missing
    - Test extraction from [staging.contracts] section
    - Test extraction from [production.contracts] section
    - Test handling malformed TOML gracefully
    - Test environment variable pattern parsing
    - _Requirements: 10.1, 10.2_

  - [ ]\* 3.5 Write property test for environment variable parsing
    - **Property 5: Environment Variable Parsing**
    - **Validates: Requirements 3.3, 3.4, 3.5**
    - Generate random env vars following naming patterns
    - Parse configuration
    - Verify all contracts extracted correctly
    - Verify field mapping is correct
    - Run minimum 100 iterations
    - _Requirements: 3.3, 3.4, 3.5_

  - [ ]\* 3.6 Write property test for dynamic contract discovery
    - **Property 6: Dynamic Contract Discovery**
    - **Validates: Requirements 5.1, 5.2**
    - Generate random valid contract entries
    - Add to configuration source
    - Verify all entries appear in parsed results
    - Verify no code modifications needed
    - Run minimum 100 iterations
    - _Requirements: 5.1, 5.2_

- [x] 4. Implement backend contract controller
  - [x] 4.1 Create contract controller with getContracts handler
    - Create `backend/src/controllers/contractController.ts`
    - Implement getContracts(req: Request, res: Response) method
    - Fetch contract entries from ContractConfigService
    - Validate each entry using contractValidator
    - Filter out invalid entries and log warnings (WARN level)
    - Format response with contracts array, timestamp (ISO 8601), and count
    - Set CORS headers for cross-origin requests
    - Set Cache-Control header with max-age=3600
    - Set Content-Type header to application/json
    - Return HTTP 200 with JSON response
    - _Requirements: 1.1, 1.3, 1.5, 2.1, 2.7, 6.1, 6.2, 6.3, 6.6, 7.2, 9.3_

  - [x] 4.2 Add error handling to controller
    - Catch configuration parsing errors and return HTTP 500
    - Catch validation errors and return HTTP 500
    - Include error message, timestamp, and details in error response
    - Log errors with ERROR level including correlation ID
    - Ensure response time under 500ms for successful requests
    - _Requirements: 1.2, 1.4, 7.1, 7.4_

  - [ ]\* 4.3 Write unit tests for contract controller
    - Test GET /api/contracts returns 200 with valid TOML config
    - Test GET /api/contracts returns 200 with valid env vars
    - Test GET /api/contracts returns 500 when no config available
    - Test response includes CORS headers
    - Test response includes Cache-Control header with max-age=3600
    - Test response Content-Type is application/json
    - Test invalid contract IDs are filtered from response
    - Test entries with missing required fields are omitted
    - Test response time is under 500ms
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ]\* 4.4 Write property test for response structure consistency
    - **Property 3: Response Structure Consistency**
    - **Validates: Requirements 6.1, 6.2, 6.3**
    - Generate random valid configurations
    - Call getContracts handler
    - Verify response has contracts array, timestamp, and count
    - Verify count equals contracts.length
    - Verify timestamp is valid ISO 8601 format
    - Run minimum 100 iterations
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]\* 4.5 Write property test for contract entries structure
    - **Property 2: Contract Entries Have Required Fields**
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6**
    - Generate random valid configurations
    - Call getContracts handler
    - Verify all entries have contractId, network, contractType, version, deployedAt
    - Verify contractId is string, network is "testnet" or "mainnet", deployedAt is positive integer
    - Run minimum 100 iterations
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 5. Implement backend routing and middleware
  - [x] 5.1 Create contract routes
    - Create `backend/src/routes/contractRoutes.ts`
    - Define GET /contracts route mapped to ContractController.getContracts
    - Apply CORS middleware
    - Apply Morgan request logging middleware
    - Apply error handling middleware
    - Export router for integration with Express app
    - _Requirements: 1.1, 1.5_

  - [x] 5.2 Integrate routes into Express application
    - Mount contract routes at /api prefix
    - Ensure route is accessible at GET /api/contracts
    - Configure CORS to allow Frontend_Client origin
    - _Requirements: 1.1, 1.5_

  - [ ]\* 5.3 Write property test for response contains contracts array
    - **Property 1: Response Contains Contracts Array**
    - **Validates: Requirements 2.1, 6.1**
    - Generate random valid configurations
    - Make GET request to /api/contracts
    - Verify response contains "contracts" property that is an array
    - Run minimum 100 iterations
    - _Requirements: 2.1, 6.1_

- [x] 6. Checkpoint - Backend implementation complete
  - Ensure all backend tests pass
  - Verify GET /api/contracts endpoint is accessible
  - Verify response format matches schema
  - Ask the user if questions arise

- [x] 7. Implement frontend contract types
  - [x] 7.1 Create TypeScript type definitions
    - Create `frontend/src/services/contracts.types.ts`
    - Define ContractEntry interface with contractId, network, contractType, version, deployedAt
    - Define ContractRegistry interface with contracts array, timestamp, count
    - Define NetworkType as "testnet" | "mainnet"
    - Define ContractType as "bulk_payment" | "vesting_escrow" | "revenue_split" | "cross_asset_payment"
    - Export all types
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 6.1, 6.2, 6.3_

- [x] 8. Implement frontend contract service
  - [x] 8.1 Create contract service class structure
    - Create `frontend/src/services/contracts.ts`
    - Define ContractService class with private cache and lastFetch properties
    - Set CACHE_TTL constant to 3600000 (1 hour)
    - Import types from contracts.types.ts
    - _Requirements: 4.1, 4.3, 9.2_

  - [x] 8.2 Implement fetch and retry logic
    - Implement fetchRegistry() method using axios.get('/api/contracts')
    - Implement retry logic with maximum 3 attempts
    - Implement exponential backoff delays: 1s, 2s, 4s
    - Throw descriptive error after all retries fail
    - Parse response and validate schema
    - _Requirements: 4.2, 4.5, 4.6, 7.5_

  - [x] 8.3 Implement caching methods
    - Implement initialize() method to fetch and cache registry
    - Implement isCacheValid() method checking lastFetch timestamp against CACHE_TTL
    - Implement getContractId(contractType: string, network: string) method
    - Return cached contract ID if cache valid
    - Auto-refresh cache if expired (older than 1 hour)
    - Return null if contract not found
    - Ensure no network requests for cached data
    - _Requirements: 4.3, 4.4, 9.1, 9.2, 9.5_

  - [x] 8.4 Implement manual refresh method
    - Implement refreshRegistry() method to manually refresh cache
    - Clear existing cache before fetching
    - Update lastFetch timestamp after successful fetch
    - _Requirements: 4.7_

  - [x] 8.5 Add error handling and logging
    - Log fetch failures to console with HTTP status code and error message
    - Log cache refresh events (development only)
    - Handle network errors gracefully
    - Handle invalid response schema errors
    - _Requirements: 7.5_

  - [ ]\* 8.6 Write unit tests for contract service
    - Test initialize() fetches from /api/contracts
    - Test getContractId() returns correct ID for cached contract
    - Test getContractId() returns null for non-existent contract
    - Test refreshRegistry() fetches fresh data
    - Test retry logic attempts 3 times on failure
    - Test exponential backoff delays are correct (1s, 2s, 4s)
    - Test error thrown after 3 failed retries
    - Test cache TTL expires after 1 hour
    - Test initial fetch completes within 2 seconds
    - _Requirements: 10.4, 10.5, 9.1_

  - [ ]\* 8.7 Write property test for cache retrieval consistency
    - **Property 7: Cache Retrieval Consistency**
    - **Validates: Requirements 4.4, 9.2**
    - Generate random contract registry
    - Initialize service with mock response
    - For each contract, call getContractId()
    - Verify returned ID matches original
    - Verify no additional network requests made
    - Run minimum 100 iterations
    - _Requirements: 4.4, 9.2_

- [ ] 9. Implement integration tests
  - [ ]\* 9.1 Write end-to-end integration test
    - Start backend server with test configuration
    - Initialize frontend ContractService
    - Verify contract access through getContractId()
    - Verify response format and data integrity
    - Verify cache behavior
    - Shutdown backend server
    - _Requirements: 10.6_

  - [ ]\* 9.2 Write cache refresh integration test
    - Initialize service and cache data
    - Simulate time passage beyond TTL
    - Call getContractId() to trigger auto-refresh
    - Verify cache updates with fresh data
    - _Requirements: 10.6, 9.5_

  - [ ]\* 9.3 Write error recovery integration test
    - Start backend server
    - Initialize frontend service
    - Simulate backend failure
    - Verify retry logic executes
    - Restore backend
    - Verify successful recovery
    - _Requirements: 10.6_

  - [ ]\* 9.4 Write property test for configuration source fallback
    - **Property 8: Configuration Source Fallback**
    - **Validates: Requirements 3.2**
    - Simulate missing environments.toml file
    - Set random environment variables
    - Call GET /api/contracts
    - Verify response contains contracts from env vars
    - Verify fallback mechanism works correctly
    - Run minimum 100 iterations
    - _Requirements: 3.2_

- [x] 10. Checkpoint - Frontend implementation complete
  - Ensure all frontend tests pass
  - Verify ContractService initializes successfully
  - Verify getContractId() returns correct contract IDs
  - Verify cache behavior works as expected
  - Ask the user if questions arise

- [x] 11. Add backward compatibility support
  - [x] 11.1 Document migration path from anchor.ts
    - Add code comments in contracts.ts explaining migration from hardcoded addresses
    - Document how to transition from anchor.ts to ContractService
    - Provide example usage patterns
    - Note that anchor.ts remains unchanged during initial deployment
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 12. Add logging and monitoring
  - [x] 12.1 Configure Winston logger for backend
    - Set up Winston with structured logging format
    - Configure log levels: ERROR, WARN, INFO, DEBUG
    - Include correlation IDs in log messages
    - Log configuration source used (INFO level)
    - Log contract count on successful load (INFO level)
    - Log parsing errors with file path and line number (ERROR level)
    - Log validation warnings for invalid entries (WARN level)
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 13. Create custom generators for property-based tests
  - [ ] 13.1 Implement fast-check custom generators
    - Create contractIdArbitrary generator for valid Stellar addresses
    - Create contractEntryArbitrary generator for valid contract entries
    - Create contractRegistryArbitrary generator for valid registries
    - Create invalidContractIdArbitrary generator for testing validation
    - Create envVarArbitrary generator for environment variable patterns
    - Document generator usage in test files
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 14. Final checkpoint - All implementation complete
  - Run full test suite (unit tests, property tests, integration tests)
  - Verify all 8 correctness properties are tested
  - Verify test coverage meets 90% minimum threshold
  - Verify backend responds correctly to GET /api/contracts
  - Verify frontend service integrates successfully
  - Verify error handling works for all failure scenarios
  - Verify logging captures all required events
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Property-based tests validate universal correctness properties across random inputs
- Unit tests validate specific examples, edge cases, and error conditions
- Integration tests verify end-to-end communication between frontend and backend
- All property tests must run minimum 100 iterations
- Backend uses TypeScript with Express.js framework
- Frontend uses TypeScript with React and Axios
- Testing uses Jest and fast-check for property-based testing
- Checkpoints ensure incremental validation and provide opportunities for user feedback
