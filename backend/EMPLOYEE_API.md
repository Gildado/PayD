# Employee Profile Management API

This document describes the CRUD endpoints for managing employee profiles with extended metadata.

## Endpoints

### Create Employee

**POST** `/api/employees`

Creates a new employee with profile information.

**Request Body:**

```json
{
  "organization_id": 1,
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "phone": "+1234567890",
  "job_title": "Software Engineer",
  "department": "Engineering",
  "position": "Senior Developer",
  "hire_date": "2024-01-15",
  "date_of_birth": "1990-05-20",
  "address_line1": "123 Main St",
  "address_line2": "Apt 4B",
  "city": "San Francisco",
  "state_province": "CA",
  "postal_code": "94102",
  "country": "USA",
  "emergency_contact_name": "Jane Doe",
  "emergency_contact_phone": "+1234567891",
  "withdrawal_preference": "bank",
  "bank_name": "Chase Bank",
  "bank_account_number": "123456789",
  "bank_routing_number": "021000021",
  "mobile_money_provider": "M-Pesa",
  "mobile_money_account": "+254712345678",
  "wallet_address": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX1",
  "status": "active",
  "notes": "Additional notes about the employee"
}
```

**Required Fields:**

- `organization_id` (number)
- `first_name` (string, max 100 chars)
- `last_name` (string, max 100 chars)
- `email` (string, valid email, max 255 chars)

**Optional Fields:**

- `phone` (string, max 20 chars)
- `job_title` (string, max 100 chars)
- `department` (string, max 100 chars)
- `position` (string, max 100 chars)
- `hire_date` (string, format: YYYY-MM-DD)
- `date_of_birth` (string, format: YYYY-MM-DD)
- `address_line1` (string, max 255 chars)
- `address_line2` (string, max 255 chars)
- `city` (string, max 100 chars)
- `state_province` (string, max 100 chars)
- `postal_code` (string, max 20 chars)
- `country` (string, max 100 chars)
- `emergency_contact_name` (string, max 200 chars)
- `emergency_contact_phone` (string, max 20 chars)
- `withdrawal_preference` (enum: 'bank', 'mobile_money', 'crypto', default: 'bank')
- `bank_name` (string, max 100 chars)
- `bank_account_number` (string, max 50 chars)
- `bank_routing_number` (string, max 50 chars)
- `mobile_money_provider` (string, max 50 chars)
- `mobile_money_account` (string, max 50 chars)
- `wallet_address` (string, max 56 chars)
- `status` (enum: 'active', 'inactive', 'pending', default: 'active')
- `notes` (text)

**Response:** `201 Created`

```json
{
  "id": 1,
  "organization_id": 1,
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  ...
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

---

### Get All Employees

**GET** `/api/employees/organizations/:organizationId`

Retrieves all employees for a specific organization.

**Response:** `200 OK`

```json
[
  {
    "id": 1,
    "organization_id": 1,
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    ...
  },
  {
    "id": 2,
    "organization_id": 1,
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane.smith@example.com",
    ...
  }
]
```

---

### Get Employee by ID

**GET** `/api/employees/organizations/:organizationId/:id`

Retrieves a specific employee by ID.

**Response:** `200 OK`

```json
{
  "id": 1,
  "organization_id": 1,
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "phone": "+1234567890",
  "job_title": "Software Engineer",
  ...
}
```

**Error Response:** `404 Not Found`

```json
{
  "error": "Employee not found"
}
```

---

### Update Employee

**PUT** `/api/employees/organizations/:organizationId/:id`

Updates an existing employee. All fields are optional.

**Request Body:**

```json
{
  "phone": "+9876543210",
  "job_title": "Senior Software Engineer",
  "withdrawal_preference": "crypto",
  "wallet_address": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX2"
}
```

**Response:** `200 OK`

```json
{
  "id": 1,
  "organization_id": 1,
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+9876543210",
  "job_title": "Senior Software Engineer",
  ...
  "updated_at": "2024-01-16T14:20:00Z"
}
```

---

### Delete Employee

**DELETE** `/api/employees/organizations/:organizationId/:id`

Deletes an employee.

**Response:** `204 No Content`

**Error Response:** `404 Not Found`

```json
{
  "error": "Employee not found"
}
```

---

## Validation Rules

1. **Email**: Must be a valid email format
2. **Dates**: Must be in YYYY-MM-DD format
3. **Status**: Must be one of: 'active', 'inactive', 'pending'
4. **Withdrawal Preference**: Must be one of: 'bank', 'mobile_money', 'crypto'
5. **String Length**: All string fields have maximum length constraints
6. **Organization ID**: Must be a positive integer

## Error Responses

### 400 Bad Request

```json
{
  "error": "Validation failed",
  "details": [
    {
      "path": ["email"],
      "message": "Invalid email"
    }
  ]
}
```

### 404 Not Found

```json
{
  "error": "Employee not found"
}
```

### 500 Internal Server Error

```json
{
  "error": "Internal server error"
}
```

## Withdrawal Preferences

The API supports three withdrawal methods for anchor integration:

1. **bank**: Traditional bank account
   - Requires: `bank_name`, `bank_account_number`, `bank_routing_number`

2. **mobile_money**: Mobile money services (e.g., M-Pesa)
   - Requires: `mobile_money_provider`, `mobile_money_account`

3. **crypto**: Direct cryptocurrency wallet
   - Requires: `wallet_address`

## Database Schema

The extended employee profile includes:

- Contact information (phone, address)
- Employment details (job_title, hire_date, department)
- Emergency contacts
- Banking/payment preferences
- Personal information (date_of_birth)
- Additional notes

All new fields are indexed appropriately for performance, and the full-text search vector includes relevant fields for searchability.
