# Overleaf Deployment Guide

This guide explains how to deploy Overleaf in a single Docker container with embedded databases and automatic LaTeX package installation.

## Architecture

All 11 Overleaf microservices, MongoDB 8.0, and Redis run inside a **single container**:

- **Direct compilation**: LaTeX runs directly in the same container
- **Simple setup**: Single command deployment
- **Auto-install packages**: Missing LaTeX packages are installed automatically during compilation
- **Process management**: Uses Phusion Baseimage with runit

## Trade-offs

### Advantages
- **Easier deployment**: One container, one command
- **Lower resource usage**: No overhead from multiple containers
- **Simpler networking**: All services on localhost
- **Automatic package installation**: Missing `.sty` files detected and installed on first compile
- **Faster startup**: No need to wait for replica set initialization

### Limitations
- **No MongoDB transactions**: Some advanced features may not work
- **Single point of failure**: If container crashes, everything goes down
- **No sandboxed compiles**: Less isolation (users can access filesystem)
- **Not recommended for production**: Suitable for personal/small team use only
- **Backup complexity**: Must backup container volumes, not separate databases

## Quick Start

### 1. Build the Image

```bash
docker build -f Dockerfile.simplified -t overleaf/overleaf-simplified:latest .
```

### 2. Start the Container

```bash
docker compose up -d
```

### 3. Access Overleaf

1. Open http://localhost in your browser
2. Navigate to http://localhost/launchpad
3. Create your admin account

## Automatic Package Installation

When `AUTO_INSTALL_PACKAGES=true` (the default in simplified mode), the CLSI compiler will:

1. Attempt to compile your LaTeX document
2. If compilation fails, parse `output.log` for missing file errors (e.g., `! LaTeX Error: File 'tikz.sty' not found`)
3. Use `tlmgr search` to find which TeX Live package provides the missing file
4. Install the package with `tlmgr install`
5. Run `texhash` to refresh the TeX database
6. Retry compilation automatically

This means you can use any LaTeX package — just write `\usepackage{tikz}` and the first compilation will install it. Subsequent compilations will be fast since the package persists in the `texlive_extra` volume.

### Disabling Auto-Install

Set `AUTO_INSTALL_PACKAGES=false` in your docker-compose environment if you prefer to manage packages manually.

## Manual Package Installation

### Method 1: Using the install script

```bash
docker exec -it overleaf bash

# Install a package
install-tex-package tikz
install-tex-package biblatex

# List installed packages
install-tex-package --list-installed
```

### Method 2: Bulk Installation

```bash
docker exec overleaf bash -c 'for pkg in tikz pgfplots biblatex beamer; do tlmgr install "$pkg"; done && texhash'
```

### Method 3: Pre-build Custom Image

Create a `Dockerfile.custom`:
```dockerfile
FROM overleaf/overleaf-simplified:latest

RUN tlmgr install \
    tikz \
    pgfplots \
    algorithm2e \
    biblatex \
    beamer \
    && texhash
```

Build and use:
```bash
docker build -f Dockerfile.custom -t overleaf-custom .
```

## Data Persistence

All data is stored in Docker volumes:

| Volume | Purpose |
|--------|---------|
| `overleaf_data` | Projects, user data, uploads |
| `mongodb_data` | Database files |
| `redis_data` | Cache and session data |
| `texlive_extra` | Installed LaTeX packages (persists across restarts) |

### Backup

```bash
# Backup all volumes
for vol in overleaf_data mongodb_data redis_data texlive_extra; do
  docker run --rm -v ${vol}:/data -v $(pwd):/backup alpine tar czf /backup/${vol}.tar.gz -C /data .
done
```

### Restore

```bash
for vol in overleaf_data mongodb_data redis_data texlive_extra; do
  docker run --rm -v ${vol}:/data -v $(pwd):/backup alpine tar xzf /backup/${vol}.tar.gz -C /data
done
```

## Environment Variables

Key variables you can customize in `docker-compose.yml`:

| Variable | Default | Description |
|----------|---------|-------------|
| `OVERLEAF_APP_NAME` | "Overleaf Community Edition" | Application name |
| `OVERLEAF_SITE_URL` | "http://localhost" | Public URL |
| `EMBEDDED_MONGO` | "true" | Run MongoDB inside the container |
| `EMBEDDED_REDIS` | "true" | Run Redis inside the container |
| `AUTO_INSTALL_PACKAGES` | "true" | Auto-install missing LaTeX packages |
| `SANDBOXED_COMPILES` | "false" | Disable sandboxed compiles |
| `EMAIL_CONFIRMATION_DISABLED` | "true" | Skip email verification |

## Monitoring

### Check Container Status
```bash
docker compose ps
```

### View Logs
```bash
# All logs
docker compose logs -f

# Inside the container — each service has its own runit log
docker exec overleaf sv status /etc/service/*
```

### Health Check
```bash
curl http://localhost/status
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker logs overleaf

# Check if ports are available
# Windows: netstat -an | findstr :80
# Linux: ss -tlnp | grep :80
```

### MongoDB connection issues
```bash
# Verify MongoDB is running
docker exec overleaf sv status mongod

# Check MongoDB connectivity
docker exec overleaf mongosh --quiet --eval "db.runCommand({ping:1})"
```

### Redis connection issues
```bash
# Verify Redis is running
docker exec overleaf sv status redis

# Check Redis connectivity
docker exec overleaf redis-cli ping
# Should return: PONG
```

### LaTeX compilation fails
```bash
# Check TeX Live installation
docker exec overleaf pdflatex --version

# Manually install a missing package
docker exec overleaf tlmgr install <package-name> && docker exec overleaf texhash
```

### Auto-install not working
- Ensure `AUTO_INSTALL_PACKAGES=true` is set
- Check CLSI logs: `docker exec overleaf cat /var/log/overleaf/clsi.log | grep auto-install`
- Verify tlmgr works: `docker exec overleaf tlmgr --version`

## Upgrading

```bash
# Pull latest code
git pull

# Rebuild image
docker build -f Dockerfile.simplified -t overleaf/overleaf-simplified:latest .

# Restart container (volumes preserve all data)
docker compose down
docker compose up -d
```

### Option 2: In-place Update
```bash
# Update npm packages inside container
docker exec overleaf-simplified bash -c 'cd /overleaf && npm update'

# Restart services
docker-compose restart
```

## Migration from Standard Overleaf

If you have an existing Overleaf installation with separate MongoDB/Redis:

### 1. Export data from old setup
```bash
# Dump MongoDB
docker exec mongo mongodump --archive=/tmp/dump.archive --gzip

# Copy dump out
docker cp mongo:/tmp/dump.archive ./mongo-dump.archive
```

### 2. Import into simplified container
```bash
# Copy dump into new container
docker cp mongo-dump.archive overleaf-simplified:/tmp/

# Restore
docker exec overleaf-simplified mongorestore --archive=/tmp/dump.archive --gzip
```

## Security Considerations

⚠️ **Warning**: This simplified setup is NOT recommended for:
- Multi-tenant environments
- Untrusted users
- Production systems requiring high availability
- Systems requiring user isolation

The lack of sandboxed compiles means users can:
- Access the filesystem during compilation
- Potentially read environment variables
- Execute arbitrary shell commands via LaTeX

**Use only for**:
- Personal instances
- Trusted small teams
- Development/testing environments
- Internal documentation systems

## Advanced Configuration

### Custom TeX Live Mirror
Edit the Dockerfile.simplified to use a different CTAN mirror:
```dockerfile
RUN tlmgr option repository https://your-mirror.example.com/systems/texlive/tlnet
```

### Resource Limits
Add to `docker-compose.yml`:
```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 4G
    reservations:
      memory: 2G
```

### Enable HTTPS
Use a reverse proxy like nginx or Caddy:
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.overleaf.rule=Host(`overleaf.example.com`)"
  - "traefik.http.routers.overleaf.tls.certresolver=letsencrypt"
```

## Support

For issues specific to this simplified deployment:
1. Check the troubleshooting section above
2. Review container logs
3. For general Overleaf issues, see: https://github.com/overleaf/overleaf/wiki

For standard Overleaf deployment questions:
- Official documentation: https://github.com/overleaf/toolkit/
- Community forum: https://github.com/overleaf/overleaf/discussions
