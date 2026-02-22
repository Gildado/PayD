#!/bin/bash

# Test script for Employee Profile Management API
# Make sure the backend server is running before executing this script

BASE_URL="http://localhost:3000/api/employees"
ORG_ID=1

echo "=== Testing Employee Profile Management API ==="
echo ""

# Test 1: Create a new employee
echo "1. Creating a new employee..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": 1,
    "first_name": "Alice",
    "last_name": "Johnson",
    "email": "alice.johnson@example.com",
    "phone": "+1234567890",
    "job_title": "Senior Software Engineer",
    "department": "Engineering",
    "hire_date": "2024-01-15",
    "city": "San Francisco",
    "state_province": "CA",
    "country": "USA",
    "withdrawal_preference": "bank",
    "bank_name": "Chase Bank",
    "bank_account_number": "123456789",
    "bank_routing_number": "021000021"
  }')

echo "$CREATE_RESPONSE" | jq '.'
EMPLOYEE_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id')
echo "Created employee with ID: $EMPLOYEE_ID"
echo ""

# Test 2: Get all employees
echo "2. Getting all employees for organization $ORG_ID..."
curl -s -X GET "$BASE_URL/organizations/$ORG_ID" | jq '.'
echo ""

# Test 3: Get specific employee
echo "3. Getting employee with ID $EMPLOYEE_ID..."
curl -s -X GET "$BASE_URL/organizations/$ORG_ID/$EMPLOYEE_ID" | jq '.'
echo ""

# Test 4: Update employee
echo "4. Updating employee $EMPLOYEE_ID..."
curl -s -X PUT "$BASE_URL/organizations/$ORG_ID/$EMPLOYEE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+9876543210",
    "job_title": "Principal Software Engineer",
    "withdrawal_preference": "crypto",
    "wallet_address": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX1"
  }' | jq '.'
echo ""

# Test 5: Get updated employee
echo "5. Getting updated employee..."
curl -s -X GET "$BASE_URL/organizations/$ORG_ID/$EMPLOYEE_ID" | jq '.'
echo ""

# Test 6: Delete employee (optional - uncomment to test)
# echo "6. Deleting employee $EMPLOYEE_ID..."
# curl -s -X DELETE "$BASE_URL/organizations/$ORG_ID/$EMPLOYEE_ID"
# echo "Employee deleted"
# echo ""

echo "=== Tests completed ==="
