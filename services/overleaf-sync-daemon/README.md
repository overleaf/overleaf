# overleaf-sync-daemon

Bidirectional OT sync bridge between a working directory and an Overleaf
project. Runs inside the per-user Claude Code container alongside
`code-server` + the Claude Code VS Code extension, so that Claude's file
edits appear in the Overleaf web editor in real time and vice versa.

## Architecture

```
            ┌────────────────────────────────────┐
            │  Container (one per user×project)  │
            │                                    │
  Claude ──▶│  /workspace/*.tex                  │
            │       │                            │
            │       │ chokidar                   │
            │       ▼                            │
            │  overleaf-sync-daemon              │
            │       │      ▲                     │
            └───────┼──────┼─────────────────────┘
                    │      │
            HTTP    │      │  SSE
                    │      │
            POST    │      │  GET
   /inject-op       │      │  /applied-ops/stream
                    ▼      │
            ┌────────────────────────┐
            │  document-updater      │
            │  (regular OT pipeline) │
            └───────────┬────────────┘
                        │
                        ▼  Redis pub/sub `applied-ops`
            ┌────────────────────────┐
            │  real-time (Socket.IO) │
            │  → Web browser editor  │
            └────────────────────────┘
```

Bootstrap:

1. `POST {WEB_URL}/project/:projectId/join` (basic auth) → returns the
   project's `rootFolder` tree with all doc ids + pathnames.
2. For each doc, `GET {DOC_UPDATER_URL}/project/:p/doc/:d` → write the
   content to `/workspace/<pathname>`, store `{shadow, version}`.

Runtime:

* **FS → Overleaf** — chokidar fires on file change → diff vs shadow →
  compute ShareJS ops via `diff-match-patch` → `POST .../inject-op`
  with `source = claude-sync:<random>`.
* **Overleaf → FS** — SSE stream receives `applied-ops` envelopes →
  apply ops to shadow → write file. Echoes whose `meta.source` matches
  our own source tag are skipped (loop guard).
* Each file we write bumps a per-doc `ignoreFsWrites` counter so the
  next chokidar event for that file is dropped.

## Environment

| Variable              | Required | Notes                                        |
| --------------------- | -------- | -------------------------------------------- |
| `OVERLEAF_PROJECT_ID` | yes      | Project ObjectId                             |
| `OVERLEAF_USER_ID`    | yes      | User to credit edits to (used by joinProject)|
| `DOC_UPDATER_URL`     | yes      | e.g. `http://document-updater:3003`          |
| `WEB_URL`             | yes      | e.g. `http://web:3000` (internal service URL)|
| `WEB_API_USER`        | yes      | Basic-auth user (shared with web)            |
| `WEB_API_PASSWORD`    | yes      | Basic-auth password (shared with web)        |
| `WORKSPACE_DIR`       | yes      | e.g. `/workspace`                            |

## Structural sync

Beyond OT text sync, the daemon also handles:

| Workspace action            | Outbound API                                |
| --------------------------- | ------------------------------------------- |
| create text file            | `POST  /internal/ai-sync/.../doc`           |
| create directory            | `POST  /internal/ai-sync/.../folder`        |
| delete file or directory    | `DELETE /internal/ai-sync/.../entity/...`   |

| Overleaf event           | Inbound action                                    |
| ------------------------ | ------------------------------------------------- |
| `reciveNewDoc`           | fetch via doc-updater, write to workspace         |
| `reciveNewFile`          | fetch binary via internal file endpoint           |
| `reciveNewFolder`        | `mkdir`                                           |
| `reciveEntityRename`     | `rename` on disk                                  |
| `reciveEntityMove`       | `rename` on disk                                  |
| `removeEntity`           | `rm -rf` on disk                                  |

Loop guards prevent re-applying our own structural changes (we tag them
with `source = 'claude-sync'` and the inbound stream filters them out).

## Binary files

* Inbound: binary files (`fileRefs`) are downloaded at bootstrap and
  whenever `reciveNewFile` arrives.
* Outbound: new files Claude creates with non-text extensions are
  **skipped** — the daemon logs a warning and the file stays in the
  workspace but isn't pushed to Overleaf. Use git-bridge for binary
  contributions.

Text vs binary is determined by extension (see `TEXT_EXTENSIONS` in
`lib/syncer.js`).

## Limitations

* Version tracking is optimistic — if `inject-op` is rejected (e.g.
  stale `v`) we re-fetch the doc and continue, losing the in-flight edit.
* No backpressure on the SSE streams; very high-frequency edits may queue.
* Renames inside the workspace appear to chokidar as `unlink` + `add`,
  so on the Overleaf side they show up as delete + create rather than a
  rename (loses link-file references).

## Tests

```
yarn test
# or
npx mocha --recursive --exit test
```
