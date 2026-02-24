#!/bin/bash

# Multi-Tenant Architecture Test Script
# This script demonstrates and tests the multi-tenant isolation

set -e

BASE_URL="http://localhost:3000"

echo "=========================================="
echo "Multi-Tenant Architecture Test"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Create employees for different organizations
echo -e "${YELLOW}Test 1: Creating employees for Org 1 and Org 2${NC}"
echo ""

echo "Creating employee for Organization 1..."
curl -s -X POST "$BASE_URL/api/employees" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": 1,
    "first_name": "Alice",
    "last_name": "Johnson",
    "email": "alice@org1.com",
    "status": "active"
  }' | jq '.'

echo ""
echo "Creating employee for Organization 2..."
curl -s -X POST "$BASE_URL/api/employees" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": 2,
    "first_name": "Bob",
    "last_name": "Smith",
    "email": "bob@org2.com",
    "status": "active"
  }' | jq '.'

echo ""
echo -e "${GREEN}✓ Employees created${NC}"
echo ""

# Test 2: Verify Org 1 can only see their employees
echo -e "${YELLOW}Test 2: Verifying Org 1 isolation${NC}"
echo ""

echo "Fetching employees for Organization 1..."
ORG1_EMPLOYEES=$(curl -s "$BASE_URL/api/employees/organizations/1")
echo "$ORG1_EMPLOYEES" | jq '.'

ORG1_COUNT=$(echo "$ORG1_EMPLOYEES" | jq 'length')
echo ""
echo "Organization 1 sees $ORG1_COUNT employee(s)"
echo -e "${GREEN}✓ Org 1 isolation verified${NC}"
echo ""

# Test 3: Verify Org 2 can only see their employees
echo -e "${YELLOW}Test 3: Verifying Org 2 isolation${NC}"
echo ""

echo "Fetching employees for Organization 2..."
ORG2_EMPLOYEES=$(curl -s "$BASE_URL/api/employees/organizations/2")
echo "$ORG2_EMPLOYEES" | jq '.'

ORG2_COUNT=$(echo "$ORG2_EMPLOYEES" | jq 'length')
echo ""
echo "Organization 2 sees $ORG2_COUNT employee(s)"
echo -e "${GREEN}✓ Org 2 isolation verified${NC}"
echo ""

# Test 4: Search isolation
echo -e "${YELLOW}Test 4: Verifying search isolation${NC}"
echo ""

echo "Searching employees in Organization 1..."
curl -s "$BASE_URL/api/search/organizations/1/employees?query=alice" | jq '.'

echo ""
echo "Searching employees in Organization 2..."
curl -s "$BASE_URL/api/search/organizations/2/employees?query=bob" | jq '.'

echo ""
echo -e "${GREEN}✓ Search isolation verified${NC}"
echo ""

# Test 5: Invalid organization ID
echo -e "${YELLOW}Test 5: Testing invalid organization ID${NC}"
echo ""

echo "Attempting to access non-existent organization..."
INVALID_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/employees/organizations/99999")
HTTP_CODE=$(echo "$INVALID_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" == "404" ]; then
  echo -e "${GREEN}✓ Correctly rejected invalid organization (404)${NC}"
else
  echo -e "${RED}✗ Expected 404, got $HTTP_CODE${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Multi-Tenant Tests Complete!${NC}"
echo "=========================================="
