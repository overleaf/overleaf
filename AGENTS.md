# AGENTS.md

## Docker Compose Architecture

This repo has **two separate docker-compose setups** for different purposes.

### Root `/docker-compose.yml` — Production

- **Monolithic**: Single `sharelatex/sharelatex:main` container with all services bundled
- **Custom build**: Built from local source code with Lemma customizations
- **Production-ready**: Includes nginx-proxy + Let's Encrypt SSL
- **Public-facing**: Configured for `projectcobrix.com`

### `/develop/docker-compose.yml` — Development

- **Microservices**: 13+ separate containers (web, clsi, chat, docstore, etc.)
- **Builds from source**: Each service built from local Dockerfiles
- **Live-reload**: Use with `docker-compose.dev.yml` for hot-reloading
- **Localhost only**: No SSL, port 80 on 127.0.0.1

---

## Development Workflow

```bash
cd develop

# 1. Build all service images
bin/build

# 2. Start infrastructure
bin/up

# 3. Start specific service with live-reload
bin/dev web

# 4. View logs
bin/logs web

# 5. Shut down
bin/down
```

### Helper Scripts

| Script | Purpose |
|--------|---------|
| `bin/build` | Build all images from source |
| `bin/up` | Start all services (detached) |
| `bin/down` | Stop and remove containers |
| `bin/dev <service>` | Start service with live-reload + debugging |
| `bin/logs <service>` | Tail logs |

---

## Building for Production

### Image Architecture

Overleaf uses a **two-layer image system**:

```
┌─────────────────────────────────────────────────────────────┐
│  sharelatex/sharelatex:main (Community Image)               │
│  - Your application code                                    │
│  - Services (web, clsi, chat, etc.)                        │
│  - Settings and configuration                               │
├─────────────────────────────────────────────────────────────┤
│  sharelatex/sharelatex-base:latest (Base Image)             │
│  - TexLive (LaTeX distribution) ~4GB                       │
│  - System dependencies (Node.js, nginx, etc.)              │
│  - Rarely needs rebuilding                                  │
└─────────────────────────────────────────────────────────────┘
```

### Build Commands

**Option 1: Direct docker build (recommended)**

```bash
# From repo root
cd /home/ec2-user/LemmaForLatex

# Build using official base image (faster, ~5-10 min)
docker build \
  --progress=plain \
  --file server-ce/Dockerfile \
  --tag sharelatex/sharelatex:main \
  .
```

**Option 2: Using Makefile**

```bash
cd server-ce

# Build community image (requires base image to exist)
make build-community

# Build base image first if needed (slow, ~30+ min)
make build-base

# Build everything
make all
```

### After Building

Update `docker-compose.yml` to use your build:

```yaml
services:
    sharelatex:
        image: sharelatex/sharelatex:main  # Your custom build
```

Then deploy:

```bash
docker-compose down
docker-compose up -d
```

---

## When to Rebuild

| Change Type | Action Required |
|-------------|-----------------|
| Frontend code (`services/web/frontend/`) | Full rebuild |
| Backend code (`services/*/app/`) | Full rebuild |
| Settings (`server-ce/config/settings.js`) | Rebuild OR mount as volume |
| Environment variables | Just restart container |
| Docker Compose config | Just restart container |

---

## Key Files

| File | Purpose |
|------|---------|
| `/docker-compose.yml` | Production deployment |
| `/server-ce/Dockerfile` | Production image build |
| `/server-ce/Dockerfile-base` | Base image build (TexLive + deps) |
| `/server-ce/Makefile` | Build automation |
| `/server-ce/config/settings.js` | Application settings |
| `/develop/docker-compose.yml` | Development (microservices) |
| `/develop/docker-compose.dev.yml` | Live-reload overlay |
| `/develop/dev.env` | Development environment variables |
| `/services/*/Dockerfile` | Individual service Dockerfiles |

---

## Troubleshooting

### Build fails with "base image not found"

The Makefile tries to use a branch-specific base image. Use direct docker build instead:

```bash
docker build --file server-ce/Dockerfile --tag sharelatex/sharelatex:main .
```

### Changes not appearing after rebuild

1. Verify the image was built: `docker images | grep sharelatex`
2. Check docker-compose uses correct tag: `image: sharelatex/sharelatex:main`
3. Restart containers: `docker-compose down && docker-compose up -d`

### Container starts but app doesn't work

Check logs:
```bash
docker logs sharelatex --tail 100
```
