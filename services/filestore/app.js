// Metrics must be initialized before importing anything else
require('@overleaf/metrics/initialize')

const Events = require('node:events')
const Metrics = require('@overleaf/metrics')

const logger = require('@overleaf/logger')
logger.initialize(process.env.METRICS_APP_NAME || 'filestore')

const settings = require('@overleaf/settings')
const express = require('express')
const bodyParser = require('body-parser')

const fileController = require('./app/js/FileController')
const keyBuilder = require('./app/js/KeyBuilder')
const healthCheckController = require('./app/js/HealthCheckController')

const RequestLogger = require('./app/js/RequestLogger')

Events.setMaxListeners(20)

const app = express()

app.use(RequestLogger.middleware)

Metrics.open_sockets.monitor(true)
Metrics.memory.monitor(logger)
if (Metrics.event_loop) {
  Metrics.event_loop.monitor(logger)
}
Metrics.leaked_sockets.monitor(logger)

app.use(function (req, res, next) {
  Metrics.inc('http-request')
  next()
})

// Handle requests that come in after we've started shutting down
app.use((req, res, next) => {
  if (settings.shuttingDown) {
    logger.warn(
      { req, timeSinceShutdown: Date.now() - settings.shutDownTime },
      'request received after shutting down'
    )
    // We don't want keep-alive connections to be kept open when the server is shutting down.
    res.set('Connection', 'close')
  }
  next()
})

Metrics.injectMetricsRoute(app)

app.head(
  '/project/:project_id/file/:file_id',
  keyBuilder.userFileKeyMiddleware,
  fileController.getFileHead
)
app.get(
  '/project/:project_id/file/:file_id',
  keyBuilder.userFileKeyMiddleware,
  fileController.getFile
)
app.post(
  '/project/:project_id/file/:file_id',
  keyBuilder.userFileKeyMiddleware,
  fileController.insertFile
)
app.put(
  '/project/:project_id/file/:file_id',
  keyBuilder.userFileKeyMiddleware,
  bodyParser.json(),
  fileController.copyFile
)
app.delete(
  '/project/:project_id/file/:file_id',
  keyBuilder.userFileKeyMiddleware,
  fileController.deleteFile
)
app.delete(
  '/project/:project_id',
  keyBuilder.userProjectKeyMiddleware,
  fileController.deleteProject
)

app.get(
  '/project/:project_id/size',
  keyBuilder.userProjectKeyMiddleware,
  fileController.directorySize
)

app.head(
  '/template/:template_id/v/:version/:format',
  keyBuilder.templateFileKeyMiddleware,
  fileController.getFileHead
)
app.get(
  '/template/:template_id/v/:version/:format',
  keyBuilder.templateFileKeyMiddleware,
  fileController.getFile
)
app.get(
  '/template/:template_id/v/:version/:format/:sub_type',
  keyBuilder.templateFileKeyMiddleware,
  fileController.getFile
)
app.post(
  '/template/:template_id/v/:version/:format',
  keyBuilder.templateFileKeyMiddleware,
  fileController.insertFile
)

app.get(
  '/bucket/:bucket/key/*',
  keyBuilder.bucketFileKeyMiddleware,
  fileController.getFile
)

app.get('/status', function (req, res) {
  if (settings.shuttingDown) {
    res.sendStatus(503) // Service unavailable
  } else {
    res.send('filestore is up')
  }
})

app.get('/health_check', healthCheckController.check)

app.use(RequestLogger.errorHandler)

const port = settings.internal.filestore.port || 3009
const host = settings.internal.filestore.host || '0.0.0.0'

let server = null
if (!module.parent) {
  // Called directly
  server = app.listen(port, host, error => {
    if (error) {
      logger.error({ err: error }, 'Error starting Filestore')
      throw error
    }
    logger.debug(`Filestore starting up, listening on ${host}:${port}`)
  })
}

process
  .on('unhandledRejection', (reason, p) => {
    logger.err(reason, 'Unhandled Rejection at Promise', p)
  })
  .on('uncaughtException', err => {
    logger.err(err, 'Uncaught Exception thrown')
    process.exit(1)
  })

function handleShutdownSignal(signal) {
  logger.info({ signal }, 'received interrupt, cleaning up')
  if (settings.shuttingDown) {
    logger.warn({ signal }, 'already shutting down, ignoring interrupt')
    return
  }
  settings.shuttingDown = true
  settings.shutDownTime = Date.now()
  // stop accepting new connections, the callback is called when existing connections have finished
  server.close(() => {
    logger.info({ signal }, 'server closed')
    // exit after a short delay so logs can be flushed
    setTimeout(() => {
      process.exit()
    }, 100)
  })
  // close idle http keep-alive connections
  server.closeIdleConnections()
  setTimeout(() => {
    logger.info({ signal }, 'shutdown timed out, exiting')
    // close all connections immediately
    server.closeAllConnections()
    // exit after a short delay to allow for cleanup
    setTimeout(() => {
      process.exit()
    }, 100)
  }, settings.gracefulShutdownDelayInMs)
}

process.on('SIGTERM', handleShutdownSignal)

module.exports = app
