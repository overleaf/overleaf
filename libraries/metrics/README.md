# overleaf/metrics-module

Wrappers the [prom-client](https://github.com/siimon/prom-client) npm module to provide [Prometheus](https://prometheus.io/) metrics at `/metrics`.

Use:

```
const metrics = require('@overleaf/metrics')
metrics.initialize('myapp')

const express = require('express')
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
- `ENABLE_TRACE_AGENT` - enables @google-cloud/trace-agent on Google Cloud
- `ENABLE_DEBUG_AGENT` - enables @google-cloud/debug-agent on Google Cloud
- `ENABLE_PROFILE_AGENT` - enables @google-cloud/profiler on Google Cloud
- `METRICS_COMPRESSION_LEVEL` - sets the [compression level](https://www.npmjs.com/package/compression#level) for `/metrics`
- `STACKDRIVER_LOGGING` - toggles the request logging format
- `UV_THREADPOOL_SIZE` - sets the libuv [thread pool](http://docs.libuv.org/en/v1.x/threadpool.html) size
