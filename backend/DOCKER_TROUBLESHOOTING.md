# Docker Troubleshooting Guide

Common fixes for Docker permission, port mapping, and service errors when running PayD backend with Docker Compose.

## 📋 Table of Contents

- [Port Mapping Issues](#port-mapping-issues)
- [Permission Errors](#permission-errors)
- [Service Startup Failures](#service-startup-failures)
- [Database Connection Issues](#database-connection-issues)
- [Volume and Mount Issues](#volume-and-mount-issues)
- [Network Issues](#network-issues)
- [Docker Daemon Problems](#docker-daemon-problems)
- [Resource Constraints](#resource-constraints)
- [General Tips](#general-tips)

---

## Port Mapping Issues

### Problem: "Port is already allocated"

When starting containers, you get an error like:
```
Error response from daemon: Ports are not available: expose port 3001:3001 (bind: address already in use)
```

**Solutions:**

1. **Check what's using the port:**
   ```bash
   # macOS
   lsof -i :3001
   
   # Linux
   netstat -tulpn | grep :3001
   ```

2. **Stop the service using the port:**
   ```bash
   # Find the PID from above and kill it
   kill -9 <PID>
   ```

3. **Change the port in docker-compose.yml:**
   ```yaml
   services:
     api:
       ports:
         - '3002:3001'  # Change 3001 to available port
   ```

4. **Stop all Docker containers:**
   ```bash
   docker-compose down
   ```

5. **Verify Docker Desktop is running (if on macOS):**
   - Open Docker Desktop from Applications
   - Check if the docker daemon is active

**Affected Ports in PayD:**
- API: `3001` (internal) → `3001` (external)
- PostgreSQL: `5432` (internal) → `5433` (external)
- Redis: `6379` (internal) → `6380` (external)

---

## Permission Errors

### Problem: "Permission denied" when running docker commands

```
Got permission denied while trying to connect to the Docker daemon
```

**Solutions:**

1. **Add your user to the docker group (Linux):**
   ```bash
   sudo usermod -aG docker $USER
   # Apply the new group membership
   newgrp docker
   # Verify
   docker ps
   ```

2. **Restart Docker daemon (Linux):**
   ```bash
   sudo systemctl restart docker
   ```

3. **Fix Docker socket permissions:**
   ```bash
   sudo chmod 666 /var/run/docker.sock
   ```

4. **Run with sudo as temporary fix:**
   ```bash
   sudo docker-compose up
   ```

### Problem: "Operation not permitted" in volumes

When files in mounted volumes can't be accessed:

1. **Check volume permissions:**
   ```bash
   docker-compose exec api ls -la /usr/src/app
   ```

2. **Fix permissions on host:**
   ```bash
   # If running into permission issues with node_modules
   sudo chown -R $USER:$USER .
   ```

3. **Use volume mount with user mapping:**
   ```yaml
   services:
     api:
       user: "node:node"  # Explicit user
       volumes:
         - .:/usr/src/app
   ```

---

## Service Startup Failures

### Problem: "Service failed to start / Container exits with code 1"

**Debugging steps:**

1. **Check container logs:**
   ```bash
   docker-compose logs api
   docker-compose logs postgres
   docker-compose logs redis
   ```

2. **View detailed error output:**
   ```bash
   docker-compose logs --tail=100 api
   ```

3. **Run container in interactive mode:**
   ```bash
   docker-compose run --rm api sh
   # Inside container, try to run manually
   npm run dev
   ```

### Problem: "npm ERR! code ERESOLVE"

When npm dependencies can't be resolved:

1. **Clean install:**
   ```bash
   rm -rf node_modules package-lock.json
   docker-compose build --no-cache api
   docker-compose up
   ```

2. **Use npm legacy peer deps resolution:**
   ```bash
   docker-compose exec api npm install --legacy-peer-deps
   ```

3. **Force clean rebuild:**
   ```bash
   docker-compose down -v
   docker system prune -a
   docker-compose up --build
   ```

---

## Database Connection Issues

### Problem: "Cannot connect to PostgreSQL" or "Connection refused"

**Error messages:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
Error: Connection string missing or invalid
FATAL: username "payd_user" authentication failed
```

**Solutions:**

1. **Verify database service is running:**
   ```bash
   docker-compose ps
   # Should show 'postgres' with 'Up' status
   ```

2. **Check database health:**
   ```bash
   docker-compose exec postgres pg_isready -U payd_user
   ```

3. **Verify .env variables:**
   ```bash
   # Check if .env file exists and is valid
   cat .env
   # Required variables:
   # DB_USER=payd_user
   # DB_PASSWORD=payd_password
   # DB_NAME=payd_db
   ```

4. **Check connection string:**
   - Ensure `postgres` hostname is used (not `localhost`)
   - Format: `postgresql://payd_user:payd_password@postgres:5432/payd_db`

5. **View database logs:**
   ```bash
   docker-compose logs postgres
   ```

6. **Wait for database to be healthy:**
   ```bash
   # Wait 10-15 seconds after starting for postgres to initialize
   docker-compose up postgres
   # Once healthy status shows, start API
   docker-compose up api
   ```

### Problem: "Cannot connect to Redis" or "Connection refused"

**Solutions:**

1. **Verify Redis is running:**
   ```bash
   docker-compose ps
   docker-compose logs redis
   ```

2. **Check Redis connection:**
   ```bash
   docker-compose exec redis redis-cli ping
   # Should respond: PONG
   ```

3. **Reset Redis:**
   ```bash
   docker-compose down
   docker volume rm payd_redis_data  # Remove persistent data
   docker-compose up redis -d
   ```

---

## Volume and Mount Issues

### Problem: "Cannot find module" or "file not found" in container

When files exist locally but not visible in container:

1. **Verify volume is mounted:**
   ```bash
   docker-compose exec api ls -la /usr/src/app
   # Should see your files
   ```

2. **Check docker-compose.yml volumes:**
   ```yaml
   volumes:
     - .:/usr/src/app          # Current directory mounted
     - /usr/src/app/node_modules  # Named volume for node_modules
   ```

3. **Rebuild volumes:**
   ```bash
   docker-compose down -v  # Remove volumes
   docker-compose up --build
   ```

4. **Check host file paths:**
   ```bash
   pwd  # Ensure you're in the backend directory
   # Volumes should be relative to docker-compose.yml location
   ```

### Problem: "Read-only file system"

When you can't write to mounted volumes:

1. **Check volume permissions:**
   ```bash
   docker-compose exec api touch /usr/src/app/test.txt
   ```

2. **Modify docker-compose.yml to allow writes:**
   ```yaml
   volumes:
     - .:/usr/src/app:rw  # Add :rw flag
   ```

3. **On macOS with Docker Desktop:**
   - Go to Preferences → Resources → File Sharing
   - Ensure project directory is shared

### Problem: "node_modules performance issues" on macOS

When npm install is very slow in volumes:

1. **Use named volume for node_modules:**
   ```yaml
   volumes:
     - .:/usr/src/app
     - /usr/src/app/node_modules  # Already in docker-compose.yml
   ```

2. **Increase Docker resource limits:**
   - Docker Desktop → Preferences → Resources
   - Increase RAM to 4GB+, CPUs to 4+

3. **Use --mount type=cached on macOS:**
   ```yaml
   volumes:
     - .:/usr/src/app:cached
   ```

---

## Network Issues

### Problem: "Cannot reach services by hostname"

When API can't connect to postgres/redis using hostname:

1. **Verify network exists:**
   ```bash
   docker network ls | grep payd_network
   docker network inspect payd_network
   ```

2. **Ensure all services on same network:**
   ```yaml
   services:
     api:
       networks:
         - payd_network
     postgres:
       networks:
         - payd_network
     redis:
       networks:
         - payd_network
   
   networks:
     payd_network:
       driver: bridge
   ```

3. **Test service communication:**
   ```bash
   docker-compose exec api ping postgres
   docker-compose exec api redis-cli -h redis ping
   ```

4. **Check DNS resolution in container:**
   ```bash
   docker-compose exec api nslookup postgres
   ```

### Problem: "Cannot reach localhost:3001 from host"

**Solutions:**

1. **Use correct hostname:**
   - From Docker container: Use service name (`postgres`, `redis`, `api`)
   - From host machine: Use `localhost:3001` or `127.0.0.1:3001`

2. **Verify port binding:**
   ```bash
   docker-compose ps
   # Check PORT column shows 0.0.0.0:3001->3001/tcp
   ```

3. **Test from host:**
   ```bash
   curl http://localhost:3001/health
   # or
   curl http://127.0.0.1:3001/health
   ```

---

## Docker Daemon Problems

### Problem: "Cannot connect to Docker daemon"

**The Docker daemon isn't running.**

**Solutions:**

1. **Start Docker Desktop (macOS):**
   ```bash
   open /Applications/Docker.app
   # Wait for "Docker is running" message
   ```

2. **Start Docker daemon (Linux):**
   ```bash
   sudo systemctl start docker
   sudo systemctl status docker  # Verify it's running
   ```

3. **Check Docker daemon status:**
   ```bash
   docker ps
   docker info
   ```

### Problem: "docker-compose: command not found"

1. **Install Docker Compose:**
   ```bash
   # macOS (comes with Docker Desktop)
   # Linux
   sudo apt-get install docker-compose
   
   # Or use newer version
   sudo curl -L https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m) \
     -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

2. **Verify installation:**
   ```bash
   docker-compose --version
   ```

---

## Resource Constraints

### Problem: "Cannot allocate memory" or "Out of memory"

**Error messages:**
```
Cannot allocate memory
Docker container keeps restarting
```

**Solutions:**

1. **Check Docker memory allocation:**
   ```bash
   docker info | grep Memory
   ```

2. **Increase Docker resources (macOS):**
   - Docker Desktop → Preferences → Resources
   - Increase Memory (suggest 4GB minimum for PayD)
   - Increase CPUs (suggest 4 cores minimum)

3. **Limit container memory in docker-compose.yml:**
   ```yaml
   services:
     api:
       mem_limit: 512m
     postgres:
       mem_limit: 512m
   ```

4. **Clean up unused Docker resources:**
   ```bash
   docker system prune         # Remove unused containers/networks/images
   docker system prune -a      # More aggressive cleanup
   ```

5. **Check actual memory usage:**
   ```bash
   docker stats
   ```

### Problem: "Disk space full" or "No space left on device"

**Solutions:**

1. **Check Docker disk usage:**
   ```bash
   docker system df
   ```

2. **Clean up volumes:**
   ```bash
   docker volume prune         # Remove unused volumes
   docker volume rm payd_postgres_data payd_redis_data
   ```

3. **Clean Docker images:**
   ```bash
   docker image prune -a
   ```

4. **Reset everything:**
   ```bash
   docker system prune -a --volumes
   ```

---

## General Tips

### Quick Troubleshooting Checklist

- [ ] Is Docker running? (`docker ps`)
- [ ] Are all services healthy? (`docker-compose ps`)
- [ ] Check .env file exists with correct credentials
- [ ] Check recent logs (`docker-compose logs --tail=50`)
- [ ] Try a clean rebuild (`docker-compose down -v && docker-compose up --build`)
- [ ] Verify port availability (`lsof -i :PORT`)
- [ ] Check Docker resources are sufficient
- [ ] Ensure firewall allows Docker connections

### Useful Docker Commands

```bash
# View all containers
docker-compose ps

# View logs for a service
docker-compose logs api

# Follow logs in real-time
docker-compose logs -f api

# Execute command in running container
docker-compose exec api npm run test

# Rebuild specific service
docker-compose build --no-cache api

# Remove and recreate all services
docker-compose down -v && docker-compose up --build

# Access container shell
docker-compose exec api sh

# Restart a service
docker-compose restart api

# View container resource usage
docker stats

# Inspect network
docker network inspect payd_network
```

### Reset Everything (Nuclear Option)

When all else fails:

```bash
# Stop all containers
docker-compose down

# Remove all volumes
docker volume prune -a

# Remove unused images
docker image prune -a

# Start fresh
docker-compose up --build
```

---

## Getting Help

If you still have issues:

1. **Run the diagnostic script:**
   ```bash
   # From the backend directory
   ./scripts/docker-diagnose.sh
   ```
   This script checks your Docker installation, ports, resources, and configuration.

2. **Check service health:**
   ```bash
   ./scripts/docker-health-check.sh
   ```
   This verifies all services are running and accessible.

3. **Check logs thoroughly:**
   ```bash
   docker-compose logs --tail=100 api postgres redis
   ```

4. **Share error information:**
   - Docker version: `docker --version`
   - Docker Compose version: `docker-compose --version`
   - OS version
   - Output from `./scripts/docker-diagnose.sh`
   - Complete docker logs output

5. **File an issue with:**
   - Steps to reproduce
   - Complete docker logs output
   - Docker/Docker Compose versions
   - OS and hardware specs
   - Output from diagnostic script

---

**Last Updated:** 2026-03-27  
**PayD Backend Version:** Compatible with Node.js 20+, Docker 20.10+, Docker Compose 3.8+
