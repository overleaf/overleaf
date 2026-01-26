# Overleaf Codebase Guide for AI Agents

## Architecture Overview

Overleaf is a **microservices-based monorepo** for an open-source collaborative LaTeX editor. The codebase consists of:

- **11 Node.js microservices** in [services/](services/) - web, real-time, document-updater, clsi (LaTeX compiler), filestore, docstore, chat, contacts, notifications, project-history, history-v1
- **Shared libraries** in [libraries/](libraries/) - `@overleaf/logger`, `@overleaf/metrics`, `@overleaf/settings`, `@overleaf/o-error`, etc.
- **Module system** for extending the web service - see [services/web/modules/](services/web/modules/)
- **Docker-based development** environment in [develop/](develop/)

### Service Communication

Services communicate via HTTP REST APIs (not gRPC). Each service exposes:
- A health check endpoint
- Internal API endpoints for inter-service communication
- Integration with Redis for real-time updates and caching
- MongoDB for persistence

Key data flow: `web` (entry point) → `real-time` (WebSocket) → `document-updater` (operational transforms) → `docstore` (MongoDB) / `project-history` (version history)

## Development Workflow

### Starting the Development Environment

```bash
# In develop/ directory
bin/build          # Build all services
bin/up             # Start all services
bin/dev [services] # Start specific services in watch mode (auto-restart)

# Build TeX Live for PDF compilation
docker build texlive -t texlive-full

# Access at http://localhost/launchpad to create admin account
```

### Running Tests

**Services use Docker-based testing** - see each service's Makefile:

```bash
# In services/web/ or any service directory
make test                      # Run all tests
make test_unit                 # Unit tests in Docker
make test_acceptance           # Acceptance tests against live service
make test_unit MOCHA_GREP='...' # Filter by test name

# For modules
make test_unit_module MODULE=launchpad
make test_acceptance_module MODULE=launchpad
```

**Web service** also uses Vitest for newer tests:
```bash
npm run test:unit              # Run Vitest tests
npm run test:frontend          # Frontend tests
npm run test:frontend:coverage # With coverage
```

### Debugging Services

In dev mode, services expose debugger ports (attach Chrome DevTools to `chrome://inspect`):
- web: 9229
- clsi: 9230
- chat: 9231
- contacts: 9232
- docstore: 9233
- document-updater: 9234
- filestore: 9235
- notifications: 9236
- real-time: 9237
- project-history: 9240

## Code Conventions

### Error Handling with OError

Use `@overleaf/o-error` for structured errors with context:

```javascript
const OError = require('@overleaf/o-error')

// Creating errors
throw new OError('Description of error', { context: value })

// DO NOT wrap every error with OError.tag in async/await code
// Async/await preserves stack traces - only tag when adding meaningful context
try {
  await operation()
} catch (err) {
  // BAD - unnecessary wrapping
  throw OError.tag(err, 'operation failed', { id })
  
  // GOOD - let it propagate naturally
  throw err
  
  // ONLY tag when transforming or adding critical context
  if (err.code === 'SPECIFIC_ERROR') {
    throw OError.tag(err, 'business context here', { important_data })
  }
}
```

See [services/web/.github/prompts/await-migration.prompt.md](services/web/.github/prompts/await-migration.prompt.md) for async/await migration patterns.

### Module Exports Pattern

Most modules export both callback and promise APIs:

```javascript
const { callbackifyAll } = require('@overleaf/promise-utils')

const MyModule = {
  async myMethod(param) { /* implementation */ }
}

module.exports = {
  ...callbackifyAll(MyModule),  // callback API for legacy code
  promises: MyModule            // promise API for new code
}
```

### Logging and Metrics

**Always initialize metrics first** in app entry points:

```javascript
require('@overleaf/metrics/initialize')
const metrics = require('@overleaf/metrics')
const logger = require('@overleaf/logger')

logger.initialize(process.env.METRICS_APP_NAME || 'web')
metrics.injectMetricsRoute(app)
app.use(metrics.http.monitor(logger))
```

Logger accepts structured context:
```javascript
logger.info({ userId, projectId }, 'user opened project')
logger.error({ err }, 'operation failed')
```

### Settings Management

Use `@overleaf/settings` for configuration. Settings cascade:
- `config/settings.defaults.js` - base defaults
- `config/settings.overrides.saas.js` - SaaS overrides  
- `OVERLEAF_*` environment variables - runtime overrides

Access via:
```javascript
const Settings = require('@overleaf/settings')
const port = Settings.port || Settings.internal.web.port
```

### Web Service Modules

The web service supports a **module system** for feature extensions. Modules in [services/web/modules/](services/web/modules/) can:
- Add routes via `router.apply(webRouter, privateApiRouter, publicApiRouter)`
- Inject middleware via `middleware` export
- Add view includes via Settings.viewIncludes
- Declare dependencies on other modules

Modules are loaded per `Settings.moduleImportSequence` in [services/web/app/src/infrastructure/Modules.mjs](services/web/app/src/infrastructure/Modules.mjs).

## Shared Libraries

Libraries are in [libraries/](libraries/) and published as `@overleaf/*` scoped packages via npm workspaces:

- `@overleaf/logger` - Bunyan-based structured logging with GCP support
- `@overleaf/metrics` - Prometheus metrics wrapper (prom-client)
- `@overleaf/settings` - Centralized configuration system
- `@overleaf/o-error` - Structured error objects with context
- `@overleaf/object-persistor` - S3/GCS/filesystem abstraction
- `@overleaf/redis-wrapper` - Promisified Redis client
- `@overleaf/mongo-utils` - MongoDB helpers
- `@overleaf/overleaf-editor-core` - Operational transform library

## Testing Patterns

### Unit Tests

- Use **Vitest** for new ESM tests in web service (`test/**/*.spec.{js,ts}`)
- Use **Mocha** for legacy callback-style tests
- Mock external services - see [services/web/test/acceptance/src/mocks/](services/web/test/acceptance/src/mocks/)

```javascript
// Vitest example
import { expect } from 'chai'
import { vi } from 'vitest'

it('should do something', async function() {
  const result = await MyModule.promises.method(param)
  expect(result).to.equal(expected)
})
```

### Acceptance Tests

Run against live service instances in Docker. Use helpers from `test/acceptance/src/helpers/`:

```javascript
// Example pattern
beforeEach(async function() {
  this.user = await createUser()
  this.project = await createProject(this.user)
})

it('should handle request', async function() {
  const { response, body } = await fetchJson(`/project/${this.project._id}`)
  expect(response.status).to.equal(200)
})
```

## Docker and Deployment

### Development Docker Compose

[develop/docker-compose.yml](develop/docker-compose.yml) defines the full development stack with:
- All 11 microservices
- MongoDB (replica set) and Redis
- Mounted volumes for code hot-reload
- Debug port mappings

### Production Docker Image

[server-ce/Dockerfile](server-ce/Dockerfile) builds the Community Edition all-in-one image combining all services. Uses:
- [server-ce/Dockerfile-base](server-ce/Dockerfile-base) - Base image with TeX Live (heavy dependencies)
- [server-ce/runit/](server-ce/runit/) - Service management via runit
- [server-ce/services.js](server-ce/services.js) - Service definitions

## Common Pitfalls

1. **Concurrency**: Don't blindly convert `Async.mapSeries` to `Promise.all` - sequential processing is often intentional for database/Redis load management. Use controlled batching or keep sequential.

2. **Redis operations**: Prefer batch operations (`MGET`, `MSET`) over parallel individual calls (`Promise.all(keys.map(k => redis.get(k)))`).

3. **Background operations**: Preserve fire-and-forget semantics with `.catch(err => logger.error(...))` when migrating from callbacks with empty handlers.

4. **Module dependencies**: When adding code to web modules, declare dependencies in module exports and ensure `Settings.moduleImportSequence` loads them in order.

5. **Patch management**: npm package patches via `patch-package` are in [patches/](patches/) - run after `npm install` automatically.

## Key Files Reference

- [services/web/app.mjs](services/web/app.mjs) - Web service entry point
- [server-ce/services.js](server-ce/services.js) - List of all microservices
- [develop/README.md](develop/README.md) - Development environment guide
- [services/web/Makefile](services/web/Makefile) - Test and build targets
- [services/web/.github/prompts/await-migration.prompt.md](services/web/.github/prompts/await-migration.prompt.md) - Async/await migration guide

## Working with This Codebase

When making changes:
1. Identify which service(s) are affected
2. Check if shared libraries need updates (libraries are symlinked via npm workspaces)
3. Run service-specific tests with `make test_unit` and `make test_acceptance`
4. For web changes, test both callback and promise APIs if both are exported
5. Check [CONTRIBUTING.md](CONTRIBUTING.md) for CLA requirements before PRs
