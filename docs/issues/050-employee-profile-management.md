# Issue #50: Employee Profile Management

## Status: ✅ Completed

## Description

Added support for richer employee profiles, including contact details, department names, job titles, and bank/mobile money withdrawal preferences for anchor integration context.

## Implementation Summary

### 1. Database Schema Extension

**File:** `backend/src/db/migrations/002_extend_employee_profiles.sql`

Extended the `employees` table with the following fields:

- **Contact Information**: phone, address (line1, line2, city, state/province, postal code, country)
- **Employment Details**: job_title, hire_date, date_of_birth
- **Emergency Contacts**: emergency_contact_name, emergency_contact_phone
- **Withdrawal Preferences**:
  - withdrawal_preference (enum: 'bank', 'mobile_money', 'crypto')
  - Bank details: bank_name, bank_account_number, bank_routing_number
  - Mobile money: mobile_money_provider, mobile_money_account
- **Additional**: notes field for miscellaneous information

Updated the full-text search vector to include new searchable fields (job_title, phone).

### 2. Service Layer

**File:** `backend/src/services/employeeService.ts`

Created `EmployeeService` class with methods:

- `createEmployee(data)` - Create new employee with profile data
- `getEmployeeById(id, organizationId)` - Retrieve specific employee
- `getAllEmployees(organizationId)` - List all employees for an organization
- `updateEmployee(id, organizationId, data)` - Update employee profile
- `deleteEmployee(id, organizationId)` - Remove employee

### 3. Controller Layer

**File:** `backend/src/controllers/employeeController.ts`

Created `EmployeeController` with validation using Zod schemas:

- **createEmployeeSchema**: Validates all fields on creation (required: organization_id, first_name, last_name, email)
- **updateEmployeeSchema**: Validates partial updates (all fields optional)

Validation rules:

- Email format validation
- Date format validation (YYYY-MM-DD)
- Enum validation for status and withdrawal_preference
- String length constraints
- Proper error handling with detailed error messages

### 4. Routes

**File:** `backend/src/routes/employeeRoutes.ts`

RESTful API endpoints:

- `POST /api/employees` - Create employee
- `GET /api/employees/organizations/:organizationId` - List all employees
- `GET /api/employees/organizations/:organizationId/:id` - Get specific employee
- `PUT /api/employees/organizations/:organizationId/:id` - Update employee
- `DELETE /api/employees/organizations/:organizationId/:id` - Delete employee

### 5. Tests

**Files:**

- `backend/src/services/__tests__/employeeService.test.ts` (11 tests)
- `backend/src/controllers/__tests__/employeeController.test.ts` (14 tests)

All tests passing with comprehensive coverage:

- Service layer: CRUD operations, edge cases, error handling
- Controller layer: Request validation, HTTP status codes, error responses

### 6. Documentation

**Files:**

- `backend/EMPLOYEE_API.md` - Complete API documentation with examples
- `backend/test-employee-api.sh` - Manual testing script

## Acceptance Criteria

✅ **Extended database schema for employee profiles**

- Migration file created with all required fields
- Proper indexes and constraints added
- Full-text search updated

✅ **CRUD endpoints for managing profile metadata**

- All 5 RESTful endpoints implemented
- Proper HTTP methods and status codes
- Organization-scoped access control

✅ **Validation ensures mandatory fields are present**

- Zod schemas for create and update operations
- Email format validation
- Date format validation
- Enum validation for status and withdrawal preferences
- Detailed error messages for validation failures

## Testing

Run tests:

```bash
cd backend
npm test -- employeeService.test.ts
npm test -- employeeController.test.ts
```

Manual API testing:

```bash
cd backend
./test-employee-api.sh
```

## Migration Instructions

To apply the database migration:

```sql
psql -U your_user -d your_database -f backend/src/db/migrations/002_extend_employee_profiles.sql
```

## API Usage Example

```bash
# Create employee
curl -X POST http://localhost:3000/api/employees \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": 1,
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone": "+1234567890",
    "job_title": "Software Engineer",
    "withdrawal_preference": "bank",
    "bank_name": "Chase Bank",
    "bank_account_number": "123456789"
  }'

# Get all employees
curl http://localhost:3000/api/employees/organizations/1

# Update employee
curl -X PUT http://localhost:3000/api/employees/organizations/1/1 \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+9876543210",
    "job_title": "Senior Software Engineer"
  }'
```

## Files Changed/Added

### Added:

- `backend/src/db/migrations/002_extend_employee_profiles.sql`
- `backend/src/services/employeeService.ts`
- `backend/src/controllers/employeeController.ts`
- `backend/src/routes/employeeRoutes.ts`
- `backend/src/services/__tests__/employeeService.test.ts`
- `backend/src/controllers/__tests__/employeeController.test.ts`
- `backend/EMPLOYEE_API.md`
- `backend/test-employee-api.sh`
- `docs/issues/050-employee-profile-management.md`

### Modified:

- `backend/src/index.ts` - Added employee routes

## Notes

- All withdrawal preferences (bank, mobile_money, crypto) are supported for anchor integration
- The API is organization-scoped to ensure data isolation
- Full-text search includes new profile fields for better discoverability
- Comprehensive validation prevents invalid data from entering the system
- Tests ensure reliability and maintainability
