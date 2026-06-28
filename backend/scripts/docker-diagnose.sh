#!/bin/bash

# Docker Diagnostics Script for PayD Backend
# This script checks common Docker configuration issues and provides solutions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASS=0
WARN=0
FAIL=0

# Helper functions
echo_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

echo_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASS++))
}

echo_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARN++))
}

echo_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAIL++))
}

# Start diagnostics
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     PayD Backend Docker Diagnostics Script                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"

# Check if Docker is installed
echo_header "Docker Installation Check"
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo_pass "Docker is installed: $DOCKER_VERSION"
else
    echo_fail "Docker is not installed"
    echo "       Install from: https://docs.docker.com/get-docker/"
fi

# Check if Docker daemon is running
echo_header "Docker Daemon Status"
if docker info &> /dev/null; then
    echo_pass "Docker daemon is running"
else
    echo_fail "Docker daemon is not running"
    echo "       macOS: Open Docker Desktop from Applications"
    echo "       Linux: Run 'sudo systemctl start docker'"
fi

# Check Docker Compose
echo_header "Docker Compose Check"
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    echo_pass "Docker Compose is installed: $COMPOSE_VERSION"
else
    echo_fail "Docker Compose is not installed"
    echo "       Install: https://docs.docker.com/compose/install/"
fi

# Check if docker-compose.yml exists
echo_header "Docker Compose Configuration"
if [ -f "docker-compose.yml" ]; then
    echo_pass "docker-compose.yml found in current directory"
else
    echo_fail "docker-compose.yml not found in $(pwd)"
    echo "       Make sure you're running this script from the backend directory"
fi

# Check .env file
echo_header "Environment Configuration"
if [ -f ".env" ]; then
    echo_pass ".env file found"
    
    # Check for required variables
    if grep -q "DB_USER" .env && grep -q "DB_PASSWORD" .env && grep -q "DB_NAME" .env; then
        echo_pass "Required database environment variables are set"
    else
        echo_warn "Some database environment variables might be missing"
        echo "       Check .env for: DB_USER, DB_PASSWORD, DB_NAME"
    fi
else
    echo_warn ".env file not found"
    echo "       Copy from .env.example: cp .env.example .env"
fi

# Check port availability
echo_header "Port Availability Check"

check_port() {
    local port=$1
    local service=$2
    
    if [ "$(uname)" = "Darwin" ]; then
        # macOS
        if lsof -i ":$port" &> /dev/null; then
            echo_warn "Port $port ($service) appears to be in use"
            echo "           $(lsof -i :$port -F n | tail -1)"
        else
            echo_pass "Port $port ($service) is available"
        fi
    else
        # Linux
        if netstat -tuln 2>/dev/null | grep ":$port " &> /dev/null; then
            echo_warn "Port $port ($service) appears to be in use"
        else
            echo_pass "Port $port ($service) is available"
        fi
    fi
}

check_port 3001 "API"
check_port 5433 "PostgreSQL"
check_port 6380 "Redis"

# Check Docker resources
echo_header "Docker Resource Allocation"

if docker info 2>/dev/null | grep -q "Containers"; then
    CONTAINER_COUNT=$(docker ps -a -q | wc -l)
    echo_pass "Docker has $CONTAINER_COUNT total containers"
fi

if docker info 2>/dev/null | grep -q "Memory"; then
    MEMORY=$(docker info 2>/dev/null | grep "Total Memory" | awk '{print $3}')
    if [ ! -z "$MEMORY" ]; then
        echo_pass "Available memory: $MEMORY"
    fi
fi

# Check for existing containers
echo_header "Existing PayD Containers"

if docker ps -a --filter "name=payd" --format "{{.Names}}" 2>/dev/null | grep -q payd; then
    CONTAINERS=$(docker ps -a --filter "name=payd" --format "table {{.Names}}\t{{.Status}}")
    echo "Found existing PayD containers:"
    echo "$CONTAINERS" | tail -n +2 | while read -r line; do
        if echo "$line" | grep -q "Up"; then
            echo_pass "  $line"
        else
            echo_warn "  $line"
        fi
    done
else
    echo "No existing PayD containers found"
fi

# Check Docker volumes
echo_header "Docker Volumes"

if docker volume ls --filter "name=payd" --format "{{.Name}}" 2>/dev/null | grep -q payd; then
    VOLUMES=$(docker volume ls --filter "name=payd" --format "{{.Name}}")
    echo "Found PayD volumes:"
    echo "$VOLUMES" | while read -r vol; do
        echo_pass "  $vol"
    done
else
    echo "No PayD volumes found (they will be created on first run)"
fi

# Check Docker images
echo_header "Docker Images"

check_image() {
    local image=$1
    if docker image inspect "$image" &> /dev/null; then
        SIZE=$(docker image inspect "$image" --format='{{.Size}}' | numfmt --to=iec 2>/dev/null || echo "N/A")
        echo_pass "Image found: $image ($SIZE)"
    else
        echo_warn "Image not found: $image (will be downloaded on docker-compose up)"
    fi
}

check_image "node:20-alpine"
check_image "postgres:15-alpine"
check_image "redis:7-alpine"

# Check Docker network
echo_header "Docker Network Configuration"

if docker network inspect payd_network &> /dev/null; then
    echo_pass "Network 'payd_network' exists"
    NETWORK_INFO=$(docker network inspect payd_network --format='{{.Containers | len}}')
    echo "  Containers using this network: $NETWORK_INFO"
else
    echo "Network 'payd_network' will be created on first run"
fi

# Test docker-compose syntax
echo_header "Docker Compose Syntax Validation"

if command -v docker-compose &> /dev/null; then
    if docker-compose config &> /dev/null; then
        echo_pass "docker-compose.yml syntax is valid"
    else
        echo_fail "docker-compose.yml has syntax errors"
        docker-compose config 2>&1 | head -20
    fi
fi

# File system checks
echo_header "File System Permissions"

if [ "$(uname)" = "Darwin" ]; then
    # macOS Docker Desktop check
    SHARED_PATHS=$(docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
        docker:latest docker inspect $(docker ps --format '{{.ID}}' 2>/dev/null | head -1) \
        --format='{{json .Mounts}}' 2>/dev/null | grep -c "Mounts" || echo "0")
    
    if [ -d "/etc/docker/desktop" ] || pgrep -x "Docker" > /dev/null; then
        echo_pass "Docker Desktop appears to be running"
    fi
fi

# Check for common issues
echo_header "Common Issues Check"

# Check if node_modules exists
if [ -d "node_modules" ]; then
    echo_warn "node_modules exists locally"
    echo "       Docker will use the volume-mounted node_modules instead"
fi

# Check if dist exists but compiled with wrong Node version
if [ -d "dist" ]; then
    echo_pass "dist directory exists (compiled code)"
fi

# Summary
echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                      Diagnostic Summary                          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}\n"

echo -e "Passed:  ${GREEN}$PASS${NC}"
echo -e "Warned:  ${YELLOW}$WARN${NC}"
echo -e "Failed:  ${RED}$FAIL${NC}\n"

# Recommendations
if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✓ Your system appears to be properly configured!${NC}"
    echo -e "\nYou can start the backend with:"
    echo -e "${BLUE}  docker-compose up${NC}"
else
    echo -e "${RED}✗ There are issues that need to be fixed.${NC}"
    echo -e "\nFor help, see ${BLUE}DOCKER_TROUBLESHOOTING.md${NC}"
fi

if [ $WARN -gt 0 ]; then
    echo -e "\n${YELLOW}⚠ There are warnings to review above.${NC}"
fi

echo ""

# Exit with appropriate code
if [ $FAIL -gt 0 ]; then
    exit 1
else
    exit 0
fi
