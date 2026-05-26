# claude-ide-container

The per-user Docker image that hosts Claude Code inside Overleaf. One
container per `(userId, projectId)`, spun up on demand by
`services/web`'s `AiSessionManager` and torn down when the user clicks
"Stop session" in the rail panel.

Contents:

* **code-server** (`codercom/code-server`) — VS Code in the browser, served
  on port 8080 with `--auth none` (the parent web service authenticates
  before proxying anything to it; the port must never be exposed publicly).
* **claude CLI** (`@anthropic-ai/claude-code`) — Anthropic Claude Code. On
  first run the user does the OAuth flow from the integrated terminal;
  the resulting token is stored in `/home/coder/.claude` which should be
  mounted as a per-user named volume so re-auth isn't needed every
  session.
* **overleaf-sync-daemon** — bidirectional OT sync against the project
  (see `services/overleaf-sync-daemon`).

## Build

The Dockerfile expects the monorepo root as build context so it can copy
`services/overleaf-sync-daemon` in:

```
docker build -f services/claude-ide-container/Dockerfile \
  -t overleaf/claude-ide:dev .
```

## Required runtime env

| Variable              | Notes                                              |
| --------------------- | -------------------------------------------------- |
| `OVERLEAF_PROJECT_ID` | Project ObjectId                                   |
| `OVERLEAF_USER_ID`    | User ObjectId (edits credited to this user)        |
| `DOC_UPDATER_URL`     | Internal URL, e.g. `http://document-updater:3003`  |
| `WEB_URL`             | Internal URL, e.g. `http://web:3000`               |
| `WEB_API_USER`        | Basic-auth user shared with web                    |
| `WEB_API_PASSWORD`    | Basic-auth password shared with web                |

Optional: `CODE_SERVER_PORT` (default 8080), `WORKSPACE_DIR` (default
`/home/coder/workspace`).

## Volumes

* `/home/coder/.claude` — persist OAuth credentials & user prefs per-user.
* `/home/coder/workspace` — ephemeral; recreated from doc-updater on each
  start.

## Networking

Containers join an internal Overleaf docker network. They need outbound
access to `api.anthropic.com` (for Claude) and inbound access from
`services/web` only.
