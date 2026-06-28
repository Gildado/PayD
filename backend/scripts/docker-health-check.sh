#!/bin/bash

# Health Check Script for PayD Backend Services
# Verifies that all Docker containers are running and healthy

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

HEALTHY=0
UNHEALTHY=0

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}PayD Backend – Docker Health Check${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ docker-compose not found${NC}"
    exit 1
fi

# Function to check service health
check_service() {
    local service=$1
    local port=$2
    local check_cmd=$3
    
    printf "%-15s " "$service"
    
    # Check if service is running
    if docker-compose ps "$service" 2>/dev/null | grep -q "Up"; then
        # Check specific health if provided
        if [ -z "$check_cmd" ]; then
            echo -e "${GREEN}✓ Running${NC}"
            ((HEALTHY++))
        else
            # Execute health check
            if eval "$check_cmd" &> /dev/null; then
                echo -e "${GREEN}✓ Healthy${NC}"
                ((HEALTHY++))
            else
                echo -e "${YELLOW}⚠ Running but unhealthy${NC}"
                ((UNHEALTHY++))
            fi
        fi
    elif docker-compose ps "$service" 2>/dev/null | grep -q "Restarting"; then
        echo -e "${YELLOW}⚠ Restarting${NC}"
        ((UNHEALTHY++))
    else
        echo -e "${RED}✗ Not running${NC}"
        ((UNHEALTHY++))
    fi
}

echo "Service Status:"
echo "───────────────────────────────────────────────────────────"

# Check API service
check_service "api" "3001" "curl -sf http://localhost:3001/health > /dev/null"

# Check PostgreSQL
check_service "postgres" "5433" "docker-compose exec -T postgres pg_isready -U payd_user > /dev/null"

# Check Redis
check_service "redis" "6380" "docker-compose exec -T redis redis-cli ping > /dev/null"

echo ""
echo "───────────────────────────────────────────────────────────"
echo -e "Healthy:    ${GREEN}$HEALTHY${NC}"
echo -e "Unhealthy:  ${YELLOW}$UNHEALTHY${NC}"
echo "───────────────────────────────────────────────────────────\n"

# Additional checks
echo "Port Connectivity:"
echo "───────────────────────────────────────────────────────────"

# Check API connectivity
printf "%-15s " "API (3001)"
if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Accessible${NC}"
else
    echo -e "${RED}✗ Not accessible${NC}"
fi

# Check PostgreSQL connectivity
printf "%-15s " "PostgreSQL (5433)"
if timeout 2 bash -c '</dev/tcp/localhost/5433' 2>/dev/null; then
    echo -e "${GREEN}✓ Accessible${NC}"
else
    echo -e "${RED}✗ Not accessible${NC}"
fi

# Check Redis connectivity
printf "%-15s " "Redis (6380)"
if timeout 2 bash -c '</dev/tcp/localhost/6380' 2>/dev/null; then
    echo -e "${GREEN}✓ Accessible${NC}"
else
    echo -e "${RED}✗ Not accessible${NC}"
fi

echo ""
echo "───────────────────────────────────────────────────────────"

# Summary and recommendations
echo ""
if [ $UNHEALTHY -eq 0 ]; then
    echo -e "${GREEN}✓ All services are healthy!${NC}"
    echo ""
    echo "You can now test the API:"
    echo "  curl http://localhost:3001/api/contracts"
    echo ""
else
    echo -e "${YELLOW}⚠ Some services are not healthy.${NC}"
    echo ""
    echo "Check logs with:"
    echo "  docker-compose logs [service-name]"
    echo ""
    echo "For troubleshooting help, see:"
    echo "  DOCKER_TROUBLESHOOTING.md"
    echo ""
fi
