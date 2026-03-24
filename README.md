<h1 align="center">
  <br>
  <a href="https://www.overleaf.com"><img src="doc/logo.png" alt="Overleaf" width="300"></a>
</h1>

<h4 align="center">Self-Hosted Overleaf — One Command, Full LaTeX Editor</h4>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#what-makes-this-different">What's Different</a> •
  <a href="#auto-install-latex-packages">Auto-Install</a> •
  <a href="#installing-latex-packages">LaTeX Packages</a> •
  <a href="#deployment-options">Deployment Options</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#license">License</a>
</p>

<p align="center">
  <a href="https://hub.docker.com/r/blacksamuron05/overleaf-simplified">
    <img src="https://img.shields.io/docker/pulls/blacksamuron05/overleaf-simplified?label=Docker%20Pulls&logo=docker" alt="Docker Pulls">
  </a>
  <a href="https://hub.docker.com/r/blacksamuron05/overleaf-simplified">
    <img src="https://img.shields.io/docker/image-size/blacksamuron05/overleaf-simplified/latest?label=Image%20Size&logo=docker" alt="Image Size">
  </a>
</p>

<img src="doc/screenshot.png" alt="A screenshot of a project being edited in Overleaf Community Edition">
<p align="center">
  Figure 1: A screenshot of a project being edited in Overleaf Community Edition.
</p>

---

## What Makes This Different

This is a **deployment-ready fork** of the [official Overleaf Community Edition](https://github.com/overleaf/overleaf) designed for painless self-hosting. Here's what's different compared to the default Overleaf:

| Feature | Official Overleaf CE | This Fork |
|---------|---------------------|-----------|
| **Deployment complexity** | 3 containers (Overleaf + MongoDB replica set + Redis), manual replica set init | **Single container** — MongoDB + Redis embedded, zero config |
| **LaTeX packages** | `scheme-basic` only (~300MB), manual `tlmgr` required | Pre-installs **2000+ packages** (`collection-latexextra`, `collection-fontsrecommended`, etc.) |
| **Missing package handling** | Compile fails with cryptic error, manual install required | **Auto-installs missing packages on demand** — first compile that needs a package installs it automatically |
| **Babel language support** | Manual `tlmgr install babel-<lang>` required for every language | **Auto-detected and installed** — `ngerman`, `french`, `spanish`, etc. installed on first use |
| **Docker Compose** | Requires 3 services, health checks, replica set JS init | **Single service**, one `docker-compose up -d` |
| **Setup steps** | Configure replica set, wait for health checks, create admin | **Start container → open browser → create admin** |
| **Data persistence** | Separate volumes for each container | Organized volumes with simple backup/restore |
| **Public Docker image** | Build from source required | `docker pull blacksamuron05/overleaf-simplified` |
| **Target audience** | Organizations with DevOps teams | **Individual users, small teams, labs, classrooms** |

### In short

> **Official Overleaf CE**: Production-grade, multi-container microservices architecture.
> **This fork**: "I just want to write LaTeX with my team" — single container, batteries included, missing packages install themselves.

---

## Quick Start

### Option 1: Simplified All-in-One (Recommended — no build required)

```bash
# Pull the pre-built image from Docker Hub
docker pull blacksamuron05/overleaf-simplified:latest

# Download the compose file
curl -O https://raw.githubusercontent.com/overleaf/overleaf/main/docker-compose.simplified.yml
# Or clone the repo:
# git clone https://github.com/overleaf/overleaf.git && cd overleaf

# Start (single container with embedded databases)
docker compose -f docker-compose.simplified.yml up -d

# Open http://localhost/launchpad to create your admin account
```

That's it. One command. MongoDB + Redis + all 11 Overleaf microservices run inside a single container.
Missing LaTeX packages are **automatically installed** the first time a document needs them — no manual steps.

### Option 2: Standard Multi-Container Setup

For production environments or when you need MongoDB replica set features:

```bash
docker compose up -d
# Wait for MongoDB replica set to initialize, then visit http://localhost/launchpad
```

See the detailed [Simplified Deployment Guide](SIMPLIFIED-DEPLOYMENT.md) for configuration options.

---

## Auto-Install LaTeX Packages

The simplified container includes an **automatic package installer** built into the LaTeX compiler. When a document fails to compile because a package is missing, the container:

1. Parses the compile error output for missing `.sty` / `.cls` files
2. Searches TeX Live's package index to find which package provides the file
3. Installs the package via `tlmgr` into the persistent `texlive_extra` volume
4. Re-runs the compilation — automatically, without any user action
5. Repeats for up to 10 missing packages per compile click

**Babel language packages** are also auto-detected. If your document uses `\usepackage[ngerman]{babel}` and the `babel-german` package isn't installed, it is installed automatically on the first compile.

```latex
% These all work out-of-the-box — packages install themselves:
\usepackage{koma-script}     % → koma-script
\usepackage{listings}        % → listings
\usepackage{csquotes}        % → csquotes
\usepackage[ngerman]{babel}  % → babel-german
\usepackage{subfigure}       % → subfigure
```

Installed packages are stored in the `texlive_extra` Docker volume and **persist across container restarts and rebuilds**. You only pay the installation cost once.

To disable auto-install, set `AUTO_INSTALL_PACKAGES: "false"` in your compose file.

---

## Installing LaTeX Packages

The base Overleaf image ships with `scheme-basic` (minimal TeX Live). This fork provides multiple ways to add packages:

### Automatic On-Demand Installation (Default)

With `AUTO_INSTALL_PACKAGES: "true"` (the default in `docker-compose.simplified.yml`), missing packages are installed automatically on first compile. See the [Auto-Install](#auto-install-latex-packages) section above.

### Pre-installed Packages (Dockerfile.custom)

The `Dockerfile.custom` already includes commonly needed packages:

- `collection-latexextra` — ~2000 extra packages (tikz, algorithm2e, listings, etc.)
- `collection-fontsrecommended` — standard font packages
- `collection-latexrecommended` — recommended base packages
- `koma-script`, `babel-german`, `csquotes`, `subfigure`, and more

The standard `docker-compose.yml` builds from `Dockerfile.custom` by default.

### Manual Installation (Runtime)

You can also install packages manually into the running container:

```bash
docker exec overleaf bash -c 'tlmgr install biblatex && texhash'
```

Packages installed this way are stored in the `texlive_extra` volume and persist across container restarts.

### Building a Custom Image

For a permanent, reproducible setup, extend the image:

```dockerfile
# Dockerfile.custom
FROM blacksamuron05/overleaf-simplified:latest

RUN tlmgr install \
    tikz pgfplots algorithm2e biblatex beamer siunitx todonotes \
    && texhash && fmtutil-sys --all
```

```bash
docker build -f Dockerfile.custom -t my-overleaf .
```

### Finding Package Names

When compilation fails with `File 'xxx.sty' not found` (and auto-install is off):
1. The package name is usually the filename without `.sty`
2. Search [CTAN](https://www.ctan.org/) if unsure
3. See [LATEX-PACKAGES.md](LATEX-PACKAGES.md) for a full guide

---

## Deployment Options

### Architecture Overview

Overleaf consists of **11 Node.js microservices** that communicate over HTTP on localhost, fronted by nginx:

```
nginx (port 80)
  ├── web (main app, port 4000)
  ├── real-time (WebSocket, port 3026)
  ├── document-updater (OT engine, port 3003)
  ├── clsi (LaTeX compiler, port 3013)
  ├── filestore (file storage, port 3009)
  ├── docstore (document DB, port 3016)
  ├── chat (project chat, port 3010)
  ├── contacts (user contacts, port 3036)
  ├── notifications (user notifications, port 3042)
  ├── project-history (version history, port 3054)
  └── history-v1 (history API, port 3100)
```

All services run inside a single container managed by [Phusion Baseimage](https://github.com/phusion/baseimage-docker) + `runit`.

### Simplified Deployment (Single Container)

**Best for**: Personal use, small teams, labs, workshops

```
┌─────────────────────────────────────────┐
│  Single Docker Container                │
│  ┌─────────┐ ┌───────┐ ┌─────────────┐ │
│  │ MongoDB  │ │ Redis │ │ 11 Services │ │
│  │ (standalone)│       │ │  + nginx    │ │
│  └─────────┘ └───────┘ └─────────────┘ │
│  + TeX Live with on-demand packages     │
└─────────────────────────────────────────┘
```

- **Pros**: Zero config, single command deploy, can install packages at runtime
- **Cons**: No MongoDB transactions, single point of failure, not for large-scale production

### Standard Deployment (Multi-Container)

**Best for**: Organizations, production environments, >50 users

```
┌────────────┐  ┌────────────┐  ┌────────────┐
│  Overleaf  │  │  MongoDB   │  │   Redis    │
│  Container │──│  (replica  │  │            │
│            │  │   set)     │  │            │
└────────────┘  └────────────┘  └────────────┘
```

- **Pros**: Full MongoDB features, independent scaling, standard backup tools
- **Cons**: More complex setup, requires replica set initialization

### Docker Compose Files

| File | Description |
|------|-------------|
| `docker-compose.simplified.yml` | All-in-one single container (recommended for quick start) |
| `docker-compose.yml` | Standard 3-container setup with MongoDB replica set |
| `docker-compose.debug.yml` | Overlay that exposes Node.js debugger ports |

---

## Configuration

Key environment variables (set in docker-compose files):

| Variable | Default | Description |
|----------|---------|-------------|
| `OVERLEAF_APP_NAME` | "Overleaf Community Edition" | Displayed application name |
| `OVERLEAF_SITE_URL` | "http://localhost" | Public URL of the instance |
| `OVERLEAF_ADMIN_EMAIL` | — | Admin contact email |
| `EMAIL_CONFIRMATION_DISABLED` | "true" | Skip email verification |
| `OVERLEAF_EMAIL_SMTP_HOST` | — | SMTP server for outbound email |
| `SANDBOXED_COMPILES` | "false" | Enable sandbox (Server Pro only) |

See the full list in `server-ce/config/settings.js`.

---

## Data & Backups

### Simplified Container

```bash
# Backup all volumes
docker run --rm -v overleaf_data:/data -v $(pwd):/backup alpine tar czf /backup/overleaf-backup.tar.gz /data
docker run --rm -v mongodb_data:/data -v $(pwd):/backup alpine tar czf /backup/mongodb-backup.tar.gz /data

# Restore
docker run --rm -v overleaf_data:/data -v $(pwd):/backup alpine tar xzf /backup/overleaf-backup.tar.gz -C /
```

### Standard Setup

MongoDB and Redis data are in host-mounted volumes (`~/mongo_data`, `~/redis_data`, `~/sharelatex_data`). Use standard backup tools.

---

## Upgrading

```bash
# Pull the latest pre-built image
docker pull blacksamuron05/overleaf-simplified:latest

# Restart the container with the new image
docker compose -f docker-compose.simplified.yml up -d
```

For version-specific notes, see the [Release Notes on the Wiki](https://github.com/overleaf/overleaf/wiki#release-notes).

---

## Upstream Overleaf

This fork is based on [Overleaf Community Edition](https://github.com/overleaf/overleaf), an open-source online real-time collaborative LaTeX editor by the [Overleaf team](https://www.overleaf.com/about).

> [!CAUTION]
> Overleaf Community Edition is intended for use in environments where **all** users are trusted. Without Sandboxed Compiles (Server Pro only), users have full read/write access to the container's filesystem, network, and environment variables during LaTeX compilation.

For enterprise features (SSO, LDAP/SAML, tracked changes, sandboxed compiles), see [Overleaf Server Pro](https://www.overleaf.com/for/enterprises).

---

## Contributing

Please see the [CONTRIBUTING](CONTRIBUTING.md) file for information on contributing to the development of Overleaf.

## Authors

[The Overleaf Team](https://www.overleaf.com/about)

## License

The code in this repository is released under the GNU AFFERO GENERAL PUBLIC LICENSE, version 3. A copy can be found in the [`LICENSE`](LICENSE) file.

Copyright (c) Overleaf, 2014-2025.
