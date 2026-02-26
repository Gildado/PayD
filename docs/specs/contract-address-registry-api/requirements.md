# Requirements Document

## Introduction

The Contract Address Registry API provides a centralized endpoint for retrieving deployed Soroban smart contract addresses across different networks (testnet/mainnet). This feature decouples contract deployment information from the frontend build process, enabling hot-swappable contract deployments without requiring frontend rebuilds. The system sources contract addresses from server-side configuration (environments.toml or environment variables) and exposes them through a structured REST API that the frontend consumes at startup.

## Glossary

- **Contract_Registry_API**: The backend REST API endpoint that serves contract deployment information
- **Contract_Entry**: A data structure containing contractId, network, contractType, version, and deployedAt ledger sequence
- **Frontend_Client**: The React/TypeScript application that consumes the Contract Registry API
- **Contract_Service**: The frontend service module responsible for fetching and caching contract registry data
- **Soroban_Contract**: A smart contract deployed on the Stellar Soroban platform
- **Network**: The Stellar network environment (testnet or mainnet)
- **Ledger_Sequence**: The Stellar ledger number at which a contract was deployed
- **Configuration_Source**: The server-side data source (environments.toml or environment variables) containing contract addresses

## Requirements

### Requirement 1: Contract Registry API Endpoint

**User Story:** As a frontend developer, I want to fetch all deployed contract addresses from a single API endpoint, so that I can initialize the application with current contract information without hardcoding addresses.

#### Acceptance Criteria

1. THE Contract_Registry_API SHALL expose a GET endpoint at /api/contracts
2. WHEN the GET /api/contracts endpoint is called, THE Contract_Registry_API SHALL return a JSON response within 500ms
3. THE Contract_Registry_API SHALL return HTTP status 200 for successful requests
4. WHEN the Configuration_Source is unavailable or malformed, THE Contract_Registry_API SHALL return HTTP status 500 with an error message
5. THE Contract_Registry_API SHALL support CORS headers for cross-origin requests from the Frontend_Client

### Requirement 2: Contract Entry Data Structure

**User Story:** As a frontend developer, I want each contract entry to include comprehensive metadata, so that I can properly identify and version contracts across different networks.

#### Acceptance Criteria

1. THE Contract_Registry_API SHALL return an array of Contract_Entry objects
2. THE Contract_Entry SHALL include a contractId field containing the deployed contract address
3. THE Contract_Entry SHALL include a network field with values "testnet" or "mainnet"
4. THE Contract_Entry SHALL include a contractType field identifying the contract (bulk_payment, vesting_escrow, revenue_split, or cross_asset_payment)
5. THE Contract_Entry SHALL include a version field as a string
6. THE Contract_Entry SHALL include a deployedAt field containing the ledger sequence number as an integer
7. WHEN any required field is missing from the Configuration_Source, THE Contract_Registry_API SHALL omit that Contract_Entry from the response and log a warning

### Requirement 3: Configuration Source Integration

**User Story:** As a DevOps engineer, I want contract addresses to be sourced from server-side configuration, so that I can update deployments without modifying application code.

#### Acceptance Criteria

1. THE Contract_Registry_API SHALL read contract addresses from environments.toml as the primary Configuration_Source
2. WHERE environments.toml is unavailable, THE Contract_Registry_API SHALL read contract addresses from environment variables
3. THE Contract*Registry_API SHALL support the following environment variable pattern: {CONTRACT_TYPE}*{NETWORK}\_CONTRACT_ID (e.g., BULK_PAYMENT_TESTNET_CONTRACT_ID)
4. THE Contract*Registry_API SHALL support the following environment variable pattern for ledger sequences: {CONTRACT_TYPE}*{NETWORK}\_DEPLOYED_AT (e.g., BULK_PAYMENT_TESTNET_DEPLOYED_AT)
5. THE Contract*Registry_API SHALL support the following environment variable pattern for versions: {CONTRACT_TYPE}*{NETWORK}\_VERSION (e.g., BULK_PAYMENT_TESTNET_VERSION)
6. WHEN parsing environments.toml, THE Contract_Registry_API SHALL extract contract IDs from the [staging.contracts] section for testnet and [production.contracts] section for mainnet
7. THE Contract_Registry_API SHALL validate that contract IDs match the Stellar contract address format (C followed by 56 alphanumeric characters)

### Requirement 4: Frontend Contract Service

**User Story:** As a frontend developer, I want a dedicated service to fetch and cache contract addresses, so that the application can access contract information efficiently throughout its lifecycle.

#### Acceptance Criteria

1. THE Frontend_Client SHALL create a Contract_Service module in frontend/src/services/contracts.ts
2. WHEN the Frontend_Client initializes, THE Contract_Service SHALL fetch contract data from GET /api/contracts
3. THE Contract_Service SHALL cache the fetched contract registry data in memory
4. THE Contract_Service SHALL provide a method getContractId(contractType: string, network: string) that returns the cached contract ID
5. WHEN the Contract_Service fetch fails, THE Contract_Service SHALL retry up to 3 times with exponential backoff
6. WHEN all retry attempts fail, THE Contract_Service SHALL throw an error with a descriptive message
7. THE Contract_Service SHALL expose a method refreshRegistry() to manually refresh the cached data

### Requirement 5: Configuration-Driven Contract Management

**User Story:** As a DevOps engineer, I want to add new contracts by only updating configuration files, so that I can deploy new contracts without code changes.

#### Acceptance Criteria

1. WHEN a new contract entry is added to environments.toml with the required fields, THE Contract_Registry_API SHALL include it in the response without code modifications
2. WHEN a new set of environment variables matching the naming pattern is added, THE Contract_Registry_API SHALL include the contract in the response without code modifications
3. THE Contract_Registry_API SHALL dynamically discover all contract entries from the Configuration_Source at runtime
4. THE Contract_Registry_API SHALL NOT require application restart when environment variables are updated in containerized environments that support dynamic env var injection

### Requirement 6: Response Format and Validation

**User Story:** As a frontend developer, I want the API response to follow a consistent schema, so that I can reliably parse and validate the data.

#### Acceptance Criteria

1. THE Contract_Registry_API SHALL return a JSON object with a "contracts" array property
2. THE Contract_Registry_API SHALL include a "timestamp" field in ISO 8601 format indicating when the response was generated
3. THE Contract_Registry_API SHALL include a "count" field indicating the total number of contracts returned
4. THE Contract_Registry_API SHALL validate the response schema before sending
5. WHEN the response fails schema validation, THE Contract_Registry_API SHALL return HTTP status 500 with an error message
6. THE Contract_Registry_API SHALL set Content-Type header to "application/json"

### Requirement 7: Error Handling and Logging

**User Story:** As a system administrator, I want comprehensive error logging for the contract registry, so that I can diagnose configuration issues quickly.

#### Acceptance Criteria

1. WHEN the Contract_Registry_API encounters a configuration parsing error, THE Contract_Registry_API SHALL log the error with ERROR level including the file path and line number
2. WHEN a contract entry is missing required fields, THE Contract_Registry_API SHALL log a warning with WARN level including the contract identifier
3. WHEN the Contract_Registry_API successfully loads contract data, THE Contract_Registry_API SHALL log an info message with INFO level including the count of loaded contracts
4. THE Contract_Registry_API SHALL include request correlation IDs in all log messages for traceability
5. WHEN the Frontend_Client fails to fetch contract data, THE Contract_Service SHALL log the error to the browser console with the HTTP status code and error message

### Requirement 8: Backward Compatibility

**User Story:** As a frontend developer, I want the existing anchor.ts service to continue working, so that the migration to the new contract service is non-breaking.

#### Acceptance Criteria

1. THE Frontend_Client SHALL maintain the existing anchor.ts service without modifications during initial deployment
2. THE Contract_Service SHALL be implemented as a new module without removing existing contract access patterns
3. WHEN both anchor.ts and Contract_Service are present, THE Frontend_Client SHALL function correctly with either service
4. THE Contract_Service SHALL provide a migration guide in code comments for transitioning from hardcoded addresses

### Requirement 9: Performance and Caching

**User Story:** As a frontend developer, I want contract registry data to be cached efficiently, so that the application startup time is minimized.

#### Acceptance Criteria

1. THE Contract_Service SHALL complete the initial fetch and cache operation within 2 seconds under normal network conditions
2. THE Contract_Service SHALL serve subsequent getContractId() calls from cache without network requests
3. THE Contract_Registry_API SHALL include Cache-Control headers with a max-age of 3600 seconds (1 hour)
4. THE Frontend_Client SHALL respect Cache-Control headers when making requests to the Contract_Registry_API
5. WHEN the cached data is older than 1 hour, THE Contract_Service SHALL automatically refresh the cache on the next getContractId() call

### Requirement 10: Testing and Validation

**User Story:** As a QA engineer, I want comprehensive tests for the contract registry feature, so that I can verify correct behavior across different scenarios.

#### Acceptance Criteria

1. THE Contract_Registry_API SHALL have unit tests covering successful response generation from environments.toml
2. THE Contract_Registry_API SHALL have unit tests covering successful response generation from environment variables
3. THE Contract_Registry_API SHALL have unit tests covering error scenarios (missing config, invalid contract IDs, malformed data)
4. THE Contract_Service SHALL have unit tests covering successful fetch and cache operations
5. THE Contract_Service SHALL have unit tests covering retry logic and error handling
6. THE Contract_Service SHALL have integration tests verifying end-to-end communication with the Contract_Registry_API
7. WHEN running the test suite, ALL tests SHALL pass before deployment to production
