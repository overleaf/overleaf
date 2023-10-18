# overleaf/metrics-module

Wrappers the [prom-client](https://github.com/siimon/prom-client) npm module to provide [Prometheus](https://prometheus.io/) metrics at `/metrics`.

Use:

```
// Metrics must be initialized before importing anything else
require('@overleaf/metrics/initialize')

const express = require('express')
const metrics = require('@overleaf/metrics')
const app = express()
metrics.injectMetricsRoute(app)
```

Request logging can be enabled:

```
const logger = require('@overleaf/logger')
...
app.use(metrics.http.monitor(logger))
```

The metrics module can be configured through the following environment variables:

- `DEBUG_METRICS` - enables display of debugging messages to the console.
- `GCP_OPENTELEMETRY` - enables OpenTelemetry tracing for GCP
- `JAEGER_OPENTELEMETRY` - enables OpenTelemetry tracing for Jaeger (in the dev environment)
- `METRICS_APP_NAME` - the app label for metrics and spans
- `METRICS_COMPRESSION_LEVEL` - sets the [compression level](https://www.npmjs.com/package/compression#level) for `/metrics`
- `STACKDRIVER_LOGGING` - toggles the request logging format
- `UV_THREADPOOL_SIZE` - sets the libuv [thread pool](http://docs.libuv.org/en/v1.x/threadpool.html) size
