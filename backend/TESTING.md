# Testing Documentation

## Overview

This project includes comprehensive unit and integration tests for the advanced search and filtering functionality.

## Test Framework

- **Jest**: Testing framework
- **ts-jest**: TypeScript support for Jest
- **Supertest**: HTTP assertion library for API testing

## Running Tests

### Run all tests

```bash
npm test
```

### Run tests in watch mode

```bash
npm run test:watch
```

### Run tests with coverage

```bash
npm test -- --coverage
```

### Run specific test file

```bash
npm test -- searchService.test.ts
```

### Run tests matching a pattern

```bash
npm test -- --testNamePattern="should search employees"
```

## Test Structure

```
backend/src/
├── services/
│   ├── __tests__/
│   │   └── searchService.test.ts    # Unit tests for search service
│   └── searchService.ts
└── controllers/
    ├── __tests__/
    │   └── searchController.test.ts  # Integration tests for API endpoints
    └── searchController.ts
```

## Test Coverage

### SearchService Tests (Unit Tests)

**Employee Search Tests:**

- ✅ Full-text search with query parameter
- ✅ Status filtering (single and multiple statuses)
- ✅ Date range filtering (from, to, both)
- ✅ Pagination (page number, limit, offset calculation)
- ✅ Sorting (by column, order, default fallback)
- ✅ Multiple filters combined
- ✅ Empty results handling
- ✅ Invalid sort column handling

**Transaction Search Tests:**

- ✅ Full-text search with query parameter
- ✅ Status filtering (single and multiple statuses)
- ✅ Amount range filtering (min, max, both)
- ✅ Date range filtering (from, to, both)
- ✅ Employee information join
- ✅ Sorting by amount and other columns
- ✅ Complex multi-criteria search
- ✅ Large result set pagination
- ✅ Empty results handling
- ✅ Min/max amount only filtering

**Edge Cases:**

- ✅ Special characters in search queries (e.g., O'Brien)
- ✅ Very large page numbers
- ✅ Whitespace trimming in queries
- ✅ Empty string queries
- ✅ SQL injection prevention (parameterized queries)

### SearchController Tests (Integration Tests)

**Employee Endpoint Tests:**

- ✅ Default pagination
- ✅ Query parameter search
- ✅ Status filtering
- ✅ Date range filtering
- ✅ Custom pagination
- ✅ Sorting parameters
- ✅ Invalid organization ID (400 error)
- ✅ Invalid query parameters (400 error)
- ✅ Service errors (500 error)
- ✅ Complex multi-filter queries

**Transaction Endpoint Tests:**

- ✅ Default pagination
- ✅ Query parameter search
- ✅ Status filtering
- ✅ Amount range filtering
- ✅ Date range filtering
- ✅ Sorting by amount
- ✅ Invalid organization ID (400 error)
- ✅ Invalid amount parameters (400 error)
- ✅ Service errors (500 error)
- ✅ Complex multi-filter queries
- ✅ Min/max amount only filtering

**Error Handling Tests:**

- ✅ Zod validation errors
- ✅ Missing organization ID (404 error)
- ✅ Negative organization ID
- ✅ Zero organization ID

## Test Statistics

Total test suites: 2
Total test cases: 60+

### Coverage Goals

- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 90%

## Mocking Strategy

### Database Mocking

The tests mock the PostgreSQL connection pool to avoid requiring a real database:

```typescript
jest.mock('../../config/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));
```

### Service Mocking

Controller tests mock the search service to isolate API endpoint logic:

```typescript
jest.mock('../../services/searchService');
```

## Test Data

### Mock Employee Data

```typescript
{
  id: 1,
  organization_id: 1,
  first_name: 'John',
  last_name: 'Doe',
  email: 'john.doe@example.com',
  wallet_address: 'GXXXXXXX1',
  status: 'active',
  position: 'Engineer',
  department: 'Engineering',
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
}
```

### Mock Transaction Data

```typescript
{
  id: 1,
  organization_id: 1,
  employee_id: 1,
  tx_hash: 'abc123def456',
  amount: '1000.50',
  asset_code: 'USDC',
  status: 'completed',
  transaction_type: 'payment',
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  employee_first_name: 'John',
  employee_last_name: 'Doe',
}
```

## Test Scenarios

### 1. Basic Search

Tests that full-text search works correctly with PostgreSQL `tsvector`.

### 2. Filtering

Tests that all filter criteria work individually and in combination:

- Status filters
- Date range filters
- Amount range filters

### 3. Pagination

Tests that pagination calculates offsets correctly and returns proper metadata:

- Page numbers
- Limit per page
- Total count
- Total pages

### 4. Sorting

Tests that results can be sorted by various columns in ascending or descending order.

### 5. Error Handling

Tests that the API handles errors gracefully:

- Invalid input validation
- Database errors
- Missing parameters

### 6. Edge Cases

Tests unusual but valid inputs:

- Special characters
- Empty results
- Large page numbers
- Whitespace handling

## Continuous Integration

These tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run tests
  run: npm test -- --coverage --ci

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

## Best Practices

1. **Isolation**: Each test is independent and doesn't rely on others
2. **Mocking**: External dependencies are mocked to ensure fast, reliable tests
3. **Assertions**: Each test has clear, specific assertions
4. **Coverage**: Aim for high coverage but focus on meaningful tests
5. **Naming**: Test names clearly describe what they're testing
6. **Cleanup**: `beforeEach` ensures clean state for each test

## Debugging Tests

### Run a single test

```bash
npm test -- -t "should search employees with full-text query"
```

### Run tests with verbose output

```bash
npm test -- --verbose
```

### Debug in VS Code

Add this configuration to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Future Test Enhancements

1. **E2E Tests**: Add end-to-end tests with a real database
2. **Performance Tests**: Add load testing for search queries
3. **Snapshot Tests**: Add snapshot tests for API responses
4. **Contract Tests**: Add API contract tests
5. **Mutation Tests**: Use mutation testing to verify test quality

## Troubleshooting

### Tests fail with "Cannot find module"

```bash
npm install
```

### Tests timeout

Increase Jest timeout in `jest.config.js`:

```javascript
testTimeout: 10000;
```

### Coverage not generated

Ensure `collectCoverageFrom` is configured in `jest.config.js`.

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://testingjavascript.com/)

## Dependency Vulnerability Scanning

CI (`.github/workflows/dependency-audit.yml`) runs `npm audit --omit=dev --audit-level=high`
against `backend/package-lock.json` on every push and pull request to `main`, and weekly on a
schedule. The job fails when a **production** dependency has a known **high** or **critical**
advisory; moderate/low findings and dev-only dependencies don't fail the build.

Reproduce locally:

```bash
cd backend
npm run audit:ci
```

If a finding has no available fix, prefer an `overrides` entry or replacing the dependency; don't
raise the threshold to silence it. The workflow also audits the root and `frontend/` lockfiles.
