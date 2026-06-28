# Employee Profile Management API

Extended employee profiles with contact details, employment info, emergency contacts, and withdrawal preferences for anchor integration.

## Endpoints

All endpoints require JWT authentication (`Authorization: Bearer <token>`). Organization context is derived from the authenticated user's token.

### Create Employee

**POST** `/api/employees`
**Role:** EMPLOYER

**Required fields:** `first_name`, `last_name`, `email`

**Optional profile fields:**

| Field                   | Type   | Max Length | Notes                                                 |
| ----------------------- | ------ | ---------- | ----------------------------------------------------- |
| phone                   | string | 20         | Full-text searchable                                  |
| address_line1           | string | 255        |                                                       |
| address_line2           | string | 255        |                                                       |
| city                    | string | 100        |                                                       |
| state_province          | string | 100        |                                                       |
| postal_code             | string | 20         |                                                       |
| country                 | string | 100        |                                                       |
| job_title               | string | 100        | Indexed, full-text searchable                         |
| hire_date               | string | -          | YYYY-MM-DD format                                     |
| date_of_birth           | string | -          | YYYY-MM-DD format                                     |
| emergency_contact_name  | string | 200        |                                                       |
| emergency_contact_phone | string | 20         |                                                       |
| withdrawal_preference   | enum   | -          | `bank`, `mobile_money`, or `crypto` (default: `bank`) |
| bank_name               | string | 100        |                                                       |
| bank_account_number     | string | 50         |                                                       |
| bank_routing_number     | string | 50         |                                                       |
| mobile_money_provider   | string | 50         |                                                       |
| mobile_money_account    | string | 50         |                                                       |
| wallet_address          | string | 56         | Stellar public key                                    |
| status                  | enum   | -          | `active`, `inactive`, `pending` (default: `active`)   |
| base_salary             | number | -          | Non-negative (default: 0)                             |
| base_currency           | string | 12         | Default: `USDC`                                       |
| notes                   | text   | -          | Free-form notes                                       |

**Example:**

```bash
curl -X POST http://localhost:4000/api/employees \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone": "+1234567890",
    "job_title": "Software Engineer",
    "hire_date": "2024-01-15",
    "withdrawal_preference": "bank",
    "bank_name": "Chase Bank",
    "bank_account_number": "123456789",
    "bank_routing_number": "021000021"
  }'
```

**Response:** `201 Created`

---

### List Employees

**GET** `/api/employees`
**Role:** EMPLOYER

**Query parameters:**

| Param      | Type   | Default | Description                                                              |
| ---------- | ------ | ------- | ------------------------------------------------------------------------ |
| page       | number | 1       | Page number                                                              |
| limit      | number | 10      | Items per page                                                           |
| q          | string | -       | Search query — full-text search across name, email, position, department, and wallet address |
| search     | string | -       | Alias for `q` (kept for backwards compatibility; `q` takes precedence)   |
| status     | enum   | -       | Filter by status (`active`, `inactive`, `pending`)                       |
| department | string | -       | Filter by department                                                     |

**Response:** `200 OK`

```json
{
  "data": [{ "id": 1, "first_name": "John", ... }],
  "pagination": { "total": 42, "page": 1, "limit": 10, "totalPages": 5 }
}
```

---

### Get Employee

**GET** `/api/employees/:id`
**Role:** EMPLOYER, EMPLOYEE

**Response:** `200 OK` with full employee profile including all extended fields.

**Error:** `404 Not Found` if employee does not exist or belongs to a different organization.

---

### Update Employee

**PATCH** `/api/employees/:id` or **PUT** `/api/employees/:id`
**Role:** EMPLOYER

All fields are optional. Only provided fields are updated.

```bash
curl -X PATCH http://localhost:4000/api/employees/1 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+9876543210",
    "job_title": "Senior Software Engineer",
    "withdrawal_preference": "mobile_money",
    "mobile_money_provider": "M-Pesa",
    "mobile_money_account": "+254700123456"
  }'
```

**Response:** `200 OK`

---

### Bulk Import Employees

**POST** `/api/employees/bulk-import`
**Role:** EMPLOYER

Imports employees from CSV content in the request body. The route is evaluated before `/:id`, so it is not mistaken for an employee ID.

```bash
curl -X POST http://localhost:4000/api/employees/bulk-import \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": 1,
    "csv": "first_name,last_name,email,wallet_address,position,department,base_salary,base_currency\nAda,Lovelace,ada@example.com,,Engineer,R&D,1000,USDC"
  }'
```

Supported CSV headers: `first_name`, `last_name`, `email`, `wallet_address`, `position`, `department`, `base_salary`, `base_currency`.

**Response:** `201 Created` for a clean import, or `207 Multi-Status` when some rows fail validation.

---

### Delete Employee (soft delete)

**DELETE** `/api/employees/:id`
**Role:** EMPLOYER

Sets `deleted_at` and marks status as `inactive`. Record remains in database.

**Response:** `204 No Content`

---

## Withdrawal Preferences

Three withdrawal methods for anchor integration:

| Method         | Fields Required                                           |
| -------------- | --------------------------------------------------------- |
| `bank`         | `bank_name`, `bank_account_number`, `bank_routing_number` |
| `mobile_money` | `mobile_money_provider`, `mobile_money_account`           |
| `crypto`       | `wallet_address`                                          |

## Validation Rules

- **Email**: RFC 5322 format
- **Dates**: YYYY-MM-DD format
- **Status**: one of `active`, `inactive`, `pending`
- **Withdrawal preference**: one of `bank`, `mobile_money`, `crypto`
- **String lengths**: enforced per field (see table above)

## Error Responses

| Status | When                                                          |
| ------ | ------------------------------------------------------------- |
| `400`  | Validation failure (includes `details` array with Zod issues) |
| `403`  | User not associated with an organization                      |
| `404`  | Employee not found in caller's organization                   |
| `500`  | Internal server error                                         |

## Database Migration

```bash
psql -U your_user -d your_database \
  -f backend/src/db/migrations/002_extend_employee_profiles.sql
```

## Testing

```bash
cd backend
npm test -- employeeService.test.ts
npm test -- employeeController.test.ts
```
