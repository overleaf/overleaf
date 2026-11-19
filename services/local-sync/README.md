# @overleaf/local-sync

**COSL Local Folder Synchronization Service for Overleaf Community Edition**

Part of the **COSL Overleaf** distribution by [Codemo Open Source Labs (COSL)](https://github.com/codemolabs).

---

## 1. Overview

`local-sync` is a lightweight, dedicated microservice designed to mirror Overleaf projects directly into custom or default host directories in real time.

In standard Overleaf Community Edition, projects and compiled artifacts are trapped within Docker volumes and internal database/blob stores. `local-sync` bridges this gap:
- Real-time two-way synchronization of project files (`.tex`, `.bib`, images, assets).
- Automatic synchronization of compiled `.pdf` documents directly after LaTeX compilation.
- Strict security isolation and permission preservation (`uid:gid` matching the host user).

---

## 2. Architecture & Communication

- **IPC Mechanism**: Internal Unix Domain Socket (`/run/overleaf-local-sync/sync.sock`).
- **Isolation**: Runs as the host user (`uid=1000` / `gid=1000`, configurable via `LOCAL_SYNC_UID` and `LOCAL_SYNC_GID`) so all files and directories created on disk match host user permissions without needing `sudo` or root privileges.
- **Atomic Writes**: Uses staging files (`.tmp.*`) and atomic renames to prevent partial file writes during LaTeX compilation or high-frequency saves.
- **Manifest Tracking**: Maintains `.overleaf-sync.json` inside each project folder to record tracked files and hashes. When files are deleted or renamed in Overleaf, only Overleaf-tracked files are removed; personal user files placed in the folder are never deleted.

---

## 3. Security Guardrails

1. **Path Normalization**: Canonicalizes all target paths using real path resolution and blocks directory traversal (`..`) attempts.
2. **Safe Boundary Enforcement**: Prohibits syncing to root (`/`), `/etc`, `/usr`, `/bin`, `/var`, `/boot`, `/dev`, `/sys`, `/proc`, `.ssh`, `node_modules`, `overleaf-toolkit`, and container internals.
3. **Symlink Attack Mitigation**: Resolves symlinks and rejects paths targeting unpermitted locations outside the user jail.
4. **Collision Prevention**: Prevents two distinct projects from targeting the exact same folder location to eliminate accidental overwrites.

---

## 4. REST API Specification (Unix Socket)

- `GET /health`: Healthcheck endpoint. Returns `{ status: 'ok', pid, uid, gid, uptime }`.
- `POST /validate`: Validates that a requested path is safe and accessible.
  - Body: `{ "path": "/home/user/MyPaper" }`
  - Returns: `{ "valid": true, "path": "...", "exists": true|false }`
- `POST /browse`: Lists folders in a safe directory for the interactive directory picker.
  - Body: `{ "path": "/home/user" }`
  - Returns: `{ "current": "...", "parent": "...", "directories": [...] }`
- `POST /mkdir`: Creates a directory safely.
  - Body: `{ "parent": "/home/user", "folderName": "NewProject" }`
  - Returns: `{ "success": true, "path": "..." }`
- `POST /sync`: Executes an atomic synchronization run for a project.
  - Body:
    ```json
    {
      "projectId": "...",
      "targetPath": "/home/user/OverleafProjects/MyPaper",
      "files": [
        { "name": "main.tex", "content": "\\documentclass...", "type": "text" },
        { "name": "output.pdf", "url": "http://web/...", "type": "binary" }
      ]
    }
    ```
  - Returns: `{ "success": true, "syncedFiles": 2, "deletedFiles": 0 }`

---

## 5. Testing

Run the included unit and integration test suite:

```bash
node test/test-local-sync.mjs
```
