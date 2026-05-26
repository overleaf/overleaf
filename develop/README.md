# Overleaf Community Edition, development environment

## Building and running

In this `develop` directory, build the services:

```shell
bin/build
```

> [!NOTE]
> If Docker is running out of RAM while building the services in parallel, create a `.env` file in this directory containing `COMPOSE_PARALLEL_LIMIT=1`.

Then start the services:

```shell
bin/up
```

Once the services are running, open <http://localhost/launchpad> to create the first admin account.

## AI assistant (Claude Code)

The Claude Code rail panel is enabled out of the box — `bin/build` builds
the per-user IDE image (`overleaf/claude-ide:dev`) as part of the normal
build, and `bin/up` brings it up alongside everything else. No separate
build step is needed.

To use it after the stack is up:

1. Open a project at <http://localhost>.
2. In the right rail, click the Claude Code icon and **Start session**. A
   container is spawned for that `(user, project)` and code-server is
   embedded in the panel.
3. In the integrated terminal, run `claude` once. You'll be prompted to
   complete the OAuth flow in your browser; the token is persisted in a
   per-user named volume (`overleaf-claude-<userId>`), so subsequent
   sessions skip this step.

What runs where:

| Component                | Where                                     |
| ------------------------ | ----------------------------------------- |
| code-server + claude CLI | per-(user, project) container             |
| OT sync daemon           | same container, sidecar process           |
| AiSessionManager         | inside the `web` service (uses dockerode) |
| Reverse proxy            | mounted at `/ai/session/...` on `web`     |

How to disable the feature: unset `AI_SESSION_IMAGE` in `dev.env` and run
`bin/up` again. The rail panel disappears, no containers spawn, and the
`claude-ide` build step still runs (harmlessly) but the image is unused.

Notes:

* `web` mounts `/var/run/docker.sock` so `AiSessionManager` can spawn
  containers. If your Docker socket lives elsewhere, set
  `DOCKER_SOCKET_PATH` in your shell before running `bin/up`.
* All per-user containers join the `overleaf` network (named explicitly
  in `docker-compose.yml`), so they can reach `web`, `document-updater`,
  etc. by hostname.
* The `claude-ide` service in `docker-compose.yml` builds the image but
  its container exits 0 immediately (we only need the image, not a
  running instance). It'll appear as `Exited (0)` in `docker compose ps`
  — that's expected.

## Development

To avoid running `bin/build && bin/up` after every code change, you can run Overleaf
Community Edition in _development mode_, where services will automatically update on code changes.

To do this, use the included `bin/dev` script:

```shell
bin/dev
```

This will start all services using `node --watch`, which will automatically monitor the code and restart the services as necessary.

To improve performance, you can start only a subset of the services in development mode by providing a space-separated list to the `bin/dev` script:

```shell
bin/dev [service1] [service2] ... [serviceN]
```

> [!NOTE]
> Starting the `web` service in _development mode_ will only update the `web`
> service when backend code changes. In order to automatically update frontend
> code as well, make sure to start the `webpack` service in _development mode_
> as well.

If no services are named, all services will start in development mode.

## Debugging

When run in _development mode_ most services expose a debugging port to which
you can attach a debugger such as
[the inspector in Chrome's Dev Tools](chrome://inspect/) or one integrated into
an IDE. The following table shows the port exposed on the **host machine** for
each service:

| Service            | Port |
| ------------------ | ---- |
| `web`              | 9229 |
| `clsi`             | 9230 |
| `chat`             | 9231 |
| `contacts`         | 9232 |
| `docstore`         | 9233 |
| `document-updater` | 9234 |
| `filestore`        | 9235 |
| `notifications`    | 9236 |
| `real-time`        | 9237 |
| `history-v1`       | 9239 |
| `project-history`  | 9240 |

To attach to a service using Chrome's _remote debugging_, go to
<chrome://inspect/> and make sure _Discover network targets_ is checked. Next
click _Configure..._ and add an entry `localhost:[service port]` for each of the
services you want to attach a debugger to.

After adding an entry, the service will show up as a _Remote Target_ that you
can inspect and debug.
