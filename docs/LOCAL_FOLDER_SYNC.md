# Local Folder Synchronization in COSL Overleaf

**A First-Class Host Storage & Real-Time Sync Engine for Overleaf Community Edition**

*Maintained and developed by [Codemo Open Source Labs (COSL)](https://github.com/codemolabs)*

---

## Executive Summary

Standard Overleaf Community Edition stores all project source documents, uploaded assets, and compiled PDF artifacts inside Docker volumes and database collections (MongoDB, Redis, and MinIO/S3). While this design enables multi-user collaboration in isolated container environments, it poses critical limitations for developers, researchers, and engineers who wish to:
- Access their LaTeX source files directly on their host workstation.
- Integrate local tools (Git, VS Code, automated reference managers, Zotero, custom shell scripts).
- Keep local offline backups of their LaTeX source code and final compiled PDFs.

**COSL Overleaf** solves this natively by introducing **Local Folder Synchronization**:
- **Automatic Default Base Storage**: By default, projects are synced to a configurable base folder on the host (e.g. `/home/user/OverleafProjects/<Project Name>/`).
- **Per-Project Custom Overrides**: Any project can be directed to an exact host folder path chosen by the user (e.g. `/home/user/Workspace/MyThesis`).
- **Bidirectional Event-Driven Sync**: Saves occur on every document change, file upload, file rename, and LaTeX compilation (saving the rendered PDF alongside the `.tex` source).
- **Host User Permission Parity**: Files on the host filesystem are owned by the host user (`uid=1000` / `gid=1000`), never root or `www-data`.
- **Zero Data Loss Guarantee**: Non-Overleaf files placed into synced directories are strictly preserved and never deleted by the synchronizer.

---

## Architectural Blueprint

```
+-----------------------------------------------------------------------------------+
| Host Workstation                                                                  |
|                                                                                   |
|  /home/uzairserver/OverleafProjects/                                              |
|  ├── Project Alpha/                                                               |
|  │   ├── main.tex                                                                 |
|  │   ├── references.bib                                                           |
|  │   ├── figures/                                                                 |
|  │   ├── output.pdf                    <-- Compiled PDF automatically saved       |
|  │   └── .overleaf-sync.json           <-- Manifest tracking Overleaf files       |
|  │                                                                                |
|  └── Project Beta (Custom Path: /home/uzairserver/Documents/Thesis)               |
+-----------------------------------------------------------------------------------+
          ^
          | (Mounted Bind: /home/uzairserver:/home/uzairserver:rw)
          v
+-----------------------------------------------------------------------------------+
| Docker Container: sharelatex (codemolabs/overleaf:latest)                         |
|                                                                                   |
|  +--------------------------------+       +------------------------------------+  |
|  | services/web                   |       | services/local-sync                |  |
|  | - React Dashboard UI           |       | - Runit daemon (uid=1000:gid=1000) |  |
|  | - LocalProjectSyncController   |  IPC  | - HTTP over Unix Domain Socket     |  |
|  | - LocalProjectSyncManager      | ----> |   /run/overleaf-local-sync/        |  |
|  | - Mongoose Project/User Schema |       |   sync.sock                        |  |
|  | - TpdsUpdateSender Hooks       |       | - Atomic file writer (.tmp.*)      |  |
|  | - CompileController Hooks      |       | - Safe path validator & browser    |  |
|  +--------------------------------+       +------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## Security Model & Sandboxing

1. **Path Boundary Confinement**:
   The synchronizer enforces a strict root boundary (by default the user's home directory `/home/uzairserver`). System-critical folders (`/etc`, `/boot`, `/usr`, `/bin`, `/var`, `/sys`, `/proc`, `/dev`, `/run`, `/root`, `~/.ssh`, `~/.gnupg`, `~/overleaf-toolkit`) are hard-blocked from being targeted as sync destinations.
2. **Symlink Traversal Prevention**:
   All paths are inspected with `fs.realpathSync`. Symlinks attempting to escape the user jail or target restricted paths are rejected with HTTP 403 Forbidden.
3. **Collision Avoidance**:
   Multiple projects cannot share the exact same target directory. If Project B attempts to claim the directory already owned by Project A, the request is rejected with a clear collision warning.
4. **Manifest-Based Stale File Management**:
   The synchronization engine writes a `.overleaf-sync.json` manifest recording files generated by Overleaf. When a file is removed or renamed inside Overleaf, only files recorded in the manifest are cleaned up. Any personal user files (such as local `.git`, notes, Jupyter notebooks, or custom build scripts) remain untouched.

---

## UI Components & Workflow

### 1. Project List Dashboard
- **Location Banner**: Displays the active default base folder with a quick-copy button and a "Sync All" button to instantly mirror all projects to the host disk.
- **Sidebar Integration**: Added a "Folder Location" configuration entry in the left navigation sidebar.
- **Project Folder Badges**: Every project card/row displays a badge indicating its local synchronization target folder and status.
- **Action Menu**: Each project's three-dot actions menu includes "Set Local Folder...", allowing instant configuration of custom folder paths or toggling auto-sync.

### 2. Interactive Directory Browser Modal
- Allows users to explore allowed host folders directly from the web browser.
- Displays folder hierarchies and subdirectories with breadcrumb navigation.
- Includes an in-modal "New Folder" creation tool with immediate path validation.

---

## API Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/user/settings/local-folder` | Retrieve user default base folder settings | Yes |
| `POST` | `/user/settings/local-folder` | Update user default base folder | Yes |
| `POST` | `/user/settings/local-folder/validate` | Validate host path safety and accessibility | Yes |
| `POST` | `/user/settings/local-folder/browse` | List directory contents for the folder picker | Yes |
| `POST` | `/user/settings/local-folder/mkdir` | Create a new directory within allowed boundaries | Yes |
| `GET` | `/project/:Project_id/local-folder` | Get project-specific custom path and sync status | Yes |
| `POST` | `/project/:Project_id/local-folder` | Update project custom path and auto-sync flag | Yes |
| `POST` | `/project/:Project_id/local-sync` | Trigger an immediate manual synchronization | Yes |
