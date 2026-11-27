# Docker Troubleshooting Guide

This guide covers common Docker issues and their solutions for PayD development.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Permission Errors](#permission-errors)
- [Port Mapping Issues](#port-mapping-issues)
- [Service Health Checks](#service-health-checks)
- [Database Connection Issues](#database-connection-issues)
- [Performance Issues](#performance-issues)
- [Debugging Tips](#debugging-tips)

## Installation Issues

### Docker Not Installed

**Error**: `docker: command not found`

**Solution**:
- **macOS**: Install Docker Desktop from https://www.docker.com/products/docker-desktop
- **Linux**: 
  ```bash
  sudo apt-get update
  sudo apt-get install docker.io docker-compose
  sudo usermod -aG docker $USER
  # Log out and back in for group changes to take effect
  ```
- **Windows**: Install Docker Desktop for Windows with WSL 2 backend

### Docker Daemon Not Running

**Error**: `Cannot connect to the Docker daemon`

**Solution**:
- **macOS**: Open Docker Desktop application
- **Linux**: 
  ```bash
  sudo systemctl start docker
  sudo systemctl enable docker  # Auto-start on boot
  ```
- **Windows**: Open Docker Desktop application

### Docker Compose Version Mismatch

**Error**: `docker-compose: command not found` or version conflicts

**Solution**:
```bash
# Check version
docker-compose --version

# Update Docker Compose (if using standalone)
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Or use Docker Compose V2 (built into Docker)
docker compose --version
```

---

## Permission Errors

### Permission Denied: /var/run/docker.sock

**Error**: `permission denied while trying to connect to the Docker daemon socket`

**Solution**:
```bash
# Add current user to docker group
sudo usermod -aG docker $USER

# Apply group changes without logging out
newgrp docker

# Verify
docker ps
```

### Permission Denied: Volume Mounts

**Error**: `permission denied` when accessing mounted volumes

**Solution**:
```bash
# Check volume permissions
ls -la backend/

# Fix permissions (if needed)
sudo chown -R $USER:$USER backend/

# Or run Docker with user context
docker-compose exec -u $(id -u):$(id -g) api npm run dev
```

### Cannot Remove Container

**Error**: `Error response from daemon: container is in use`

**Solution**:
```bash
# Stop all containers
docker-compose down

# Force remove container
docker rm -f <container_id>

# Clean up all stopped containers
docker container prune
```

---

## Port Mapping Issues

### Port Already in Use

**Error**: `bind: address already in use` or `Ports are not available`

**Solution**:

1. **Find process using port**:
   ```bash
   # macOS/Linux
   lsof -i :3001
   
   # Windows
   netstat -ano | findstr :3001
   ```

2. **Kill process or change port**:
   ```bash
   # Kill process (macOS/Linux)
   kill -9 <PID>
   
   # Or change port in docker-compose.yml
   ports:
     - "3002:3001"  # Use 3002 instead of 3001
   ```

3. **Restart services**:
   ```bash
   docker-compose down
   docker-compose up
   ```

### Port Mapping Not Working

**Error**: Cannot connect to service on mapped port

**Solution**:
```bash
# Verify port mapping
docker-compose ps

# Check if service is listening
docker-compose exec api netstat -tlnp | grep 3001

# Test connection
curl http://localhost:3001/health

# If still failing, check firewall
# macOS: System Preferences > Security & Privacy > Firewall
# Linux: sudo ufw allow 3001
# Windows: Windows Defender Firewall > Allow app through firewall
```

### Docker Desktop Port Forwarding (Windows/macOS)

**Issue**: Ports not accessible from host

**Solution**:
```bash
# For Docker Desktop, use localhost or 127.0.0.1
curl http://localhost:3001

# Not the Docker IP (usually 172.17.0.1)
# If using Docker Machine, get the IP:
docker-machine ip default
```

---

## Service Health Checks

### Check Service Status

```bash
# View all services
docker-compose ps

# View logs for specific service
docker-compose logs api
docker-compose logs postgres
docker-compose logs redis

# Follow logs in real-time
docker-compose logs -f api

# View last 100 lines
docker-compose logs --tail=100 api
```

### Run Health Check Script

```bash
# From backend directory
./scripts/docker-health-check.sh

# Expected output:
# ✓ API is healthy
# ✓ PostgreSQL is healthy
# ✓ Redis is healthy
```

### Manual Health Checks

```bash
# Check API health
curl http://localhost:3001/health

# Check PostgreSQL
docker-compose exec postgres pg_isready -U payd_user -d payd_db

# Check Redis
docker-compose exec redis redis-cli ping
# Expected: PONG
```

---

## Database Connection Issues

### PostgreSQL Connection Refused

**Error**: `could not connect to server: Connection refused`

**Solution**:
```bash
# Verify PostgreSQL is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres

# Verify connection
docker-compose exec postgres psql -U payd_user -d payd_db -c "SELECT 1"
```

### Database Credentials Wrong

**Error**: `FATAL: password authentication failed for user "payd_user"`

**Solution**:
```bash
# Check .env file
cat backend/.env

# Verify credentials match docker-compose.yml
# Default: payd_user / payd_password

# Reset database (WARNING: deletes all data)
docker-compose down -v
docker-compose up postgres
```

### Database Not Initialized

**Error**: `database "payd_db" does not exist`

**Solution**:
```bash
# Run migrations
docker-compose exec api npm run db:migrate

# Or manually create database
docker-compose exec postgres psql -U payd_user -c "CREATE DATABASE payd_db"
```

### Connection Pool Exhausted

**Error**: `remaining connection slots are reserved for non-replication superuser connections`

**Solution**:
```bash
# Increase connection pool in .env
DATABASE_URL=postgresql://payd_user:payd_password@postgres:5432/payd_db?max=20

# Or restart PostgreSQL to clear connections
docker-compose restart postgres

# Check active connections
docker-compose exec postgres psql -U payd_user -d payd_db -c "SELECT count(*) FROM pg_stat_activity"
```

---

## Performance Issues

### Slow Container Startup

**Issue**: Services take >30 seconds to start

**Solution**:
```bash
# Check resource allocation
docker stats

# Increase Docker resources (Docker Desktop)
# Preferences > Resources > Memory/CPU

# Or use resource limits in docker-compose.yml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### High Memory Usage

**Error**: `OOMKilled` or container exits unexpectedly

**Solution**:
```bash
# Check memory usage
docker stats

# Increase Docker memory limit
# Docker Desktop: Preferences > Resources > Memory

# Or set memory limit in docker-compose.yml
services:
  api:
    mem_limit: 2g
```

### Slow Database Queries

**Issue**: Queries take >1 second

**Solution**:
```bash
# Enable query logging
docker-compose exec postgres psql -U payd_user -d payd_db -c "ALTER SYSTEM SET log_min_duration_statement = 1000"

# Restart PostgreSQL
docker-compose restart postgres

# View slow queries
docker-compose logs postgres | grep "duration:"

# Analyze query plan
docker-compose exec postgres psql -U payd_user -d payd_db -c "EXPLAIN ANALYZE SELECT ..."
```

### Disk Space Issues

**Error**: `no space left on device`

**Solution**:
```bash
# Check disk usage
docker system df

# Clean up unused images/containers
docker system prune

# Remove all unused volumes (WARNING: deletes data)
docker volume prune

# Remove specific volume
docker volume rm payd_postgres_data
```

---

## Debugging Tips

### Access Container Shell

```bash
# Access API container
docker-compose exec api sh

# Access PostgreSQL container
docker-compose exec postgres bash

# Access Redis container
docker-compose exec redis sh

# Run command in container
docker-compose exec api npm run lint
```

### View Container Logs

```bash
# All services
docker-compose logs

# Specific service
docker-compose logs api

# Follow logs
docker-compose logs -f api

# Last 50 lines
docker-compose logs --tail=50 api

# Timestamps
docker-compose logs --timestamps api

# Since specific time
docker-compose logs --since 2024-01-15T10:00:00 api
```

### Inspect Container

```bash
# View container details
docker inspect <container_id>

# View environment variables
docker inspect <container_id> | grep -A 20 "Env"

# View mounted volumes
docker inspect <container_id> | grep -A 10 "Mounts"

# View network settings
docker inspect <container_id> | grep -A 10 "NetworkSettings"
```

### Network Debugging

```bash
# Check container network
docker network ls

# Inspect network
docker network inspect payd_network

# Test DNS resolution
docker-compose exec api nslookup postgres

# Test connectivity
docker-compose exec api curl http://postgres:5432
```

### Database Debugging

```bash
# Connect to database
docker-compose exec postgres psql -U payd_user -d payd_db

# List tables
\dt

# View table structure
\d employees

# Run query
SELECT * FROM employees LIMIT 5;

# Exit
\q
```

### Redis Debugging

```bash
# Connect to Redis
docker-compose exec redis redis-cli

# Check keys
KEYS *

# Get value
GET key_name

# Monitor commands
MONITOR

# Exit
EXIT
```

---

## Common Scenarios

### Fresh Start (Clean Slate)

```bash
# Stop and remove all containers/volumes
docker-compose down -v

# Remove images
docker-compose rm -f

# Start fresh
docker-compose up

# Run migrations
docker-compose exec api npm run db:migrate
```

### Restart Single Service

```bash
# Restart API
docker-compose restart api

# Restart PostgreSQL
docker-compose restart postgres

# Restart Redis
docker-compose restart redis
```

### Update Dependencies

```bash
# Rebuild images
docker-compose build --no-cache

# Restart services
docker-compose up
```

### View Real-Time Metrics

```bash
# CPU, memory, network usage
docker stats

# Specific container
docker stats payd_api_1
```

### Backup Database

```bash
# Dump database
docker-compose exec postgres pg_dump -U payd_user payd_db > backup.sql

# Restore database
docker-compose exec -T postgres psql -U payd_user payd_db < backup.sql
```

---

## Getting Help

If you're still experiencing issues:

1. **Check logs**: `docker-compose logs -f`
2. **Verify configuration**: `cat backend/.env` and `docker-compose.yml`
3. **Test connectivity**: `docker-compose exec api curl http://postgres:5432`
4. **Search issues**: https://github.com/Gildado/PayD/issues
5. **Ask for help**: Open a new issue with:
   - Error message
   - Docker version: `docker --version`
   - Docker Compose version: `docker-compose --version`
   - OS and version
   - Steps to reproduce
   - Output of `docker-compose ps` and `docker-compose logs`

---

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
- [Redis Docker Image](https://hub.docker.com/_/redis)
- [PayD Contributing Guide](CONTRIBUTING.md)
