# COSL Overleaf Maintenance & Contribution Guide

**Codemo Open Source Labs (COSL) Distribution & Maintenance Standards**

---

## 1. Project Governance & Ownership

This repository is maintained under **Codemo Open Source Labs (COSL)**:
- **Organization**: `@codemolabs`
- **Parent Ecosystem**: Codemo Teams
- **Classification**: Production Product & Open Source Platform
- **Upstream Source**: Forked from `overleaf/overleaf` (Community Edition)

All contributions, issues, and discussions are governed by the [COSL Organization Structure and Policies](https://github.com/codemolabs/.github).

---

## 2. Maintenance Principles

1. **Upstream Compatibility**:
   Changes and enhancements introduced by COSL must remain compatible with core Overleaf Community Edition updates. Avoid destructive alterations to the internal document store, Redis event bus, or MongoDB data structures.
2. **First-Class Developer Experience**:
   The primary mission of COSL Overleaf is empowering open source researchers, students, and engineers by tearing down the walled garden of containerized LaTeX storage.
3. **Rigorous Security Verification**:
   Features that bridge the container boundary to the host filesystem (such as `local-sync`) must adhere to strict sandboxing, path canonicalization, symlink verification, and host uid/gid isolation.
4. **Complete Toolchain Inclusion**:
   COSL Overleaf distributions package complete LaTeX environments (including `texlive-full`, IEEE packages, and common scientific typesetting tools) to eliminate missing package errors during offline compilation.

---

## 3. Building and Running COSL Overleaf

### Option A: Running with Overleaf Toolkit

COSL Overleaf is fully compatible with `overleaf-toolkit`.

1. In your toolkit directory, configure `config/overleaf.rc`:
   ```bash
   OVERLEAF_IMAGE_NAME=codemolabs/overleaf:latest
   ```

2. Add the host volume mount in `config/docker-compose.override.yml`:
   ```yaml
   services:
     sharelatex:
       volumes:
         - $HOME:$HOME:rw
   ```

3. Launch Overleaf:
   ```bash
   bin/up
   ```

### Option B: Building from Source

To build the Docker image locally:

```bash
docker build -t codemolabs/overleaf:latest -f server-ce/Dockerfile .
```

---

## 4. Branching and Release Strategy

- `main`: Production-ready release branch maintained by COSL. All code must pass linting, unit tests, and integration tests before merging.
- `feat/*`: Feature branches for new capabilities.
- `fix/*`: Bugfix branches for issues identified in community deployments.
- Releases are tagged with semantic versioning: `v<Overleaf-Version>-cosl.<Revision>` (e.g. `v6.3.0-cosl.1.0.0`).
