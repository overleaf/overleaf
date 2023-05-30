const Metrics = require('@overleaf/metrics')
Metrics.initialize(process.env.METRICS_APP_NAME || 'filestore')

const logger = require('@overleaf/logger')
logger.initialize(process.env.METRICS_APP_NAME || 'filestore')

const settings = require('@overleaf/settings')
const express = require('express')
const bodyParser = require('body-parser')

const fileController = require('./app/js/FileController')
const keyBuilder = require('./app/js/KeyBuilder')
const healthCheckController = require('./app/js/HealthCheckController')

const RequestLogger = require('./app/js/RequestLogger')

const app = express()

app.use(RequestLogger.middleware)

if (settings.sentry && settings.sentry.dsn) {
  logger.initializeErrorReporting(settings.sentry.dsn)
}

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

app.head(
  '/project/:project_id/public/:public_file_id',
  keyBuilder.publicFileKeyMiddleware,
  fileController.getFileHead
)
app.get(
  '/project/:project_id/public/:public_file_id',
  keyBuilder.publicFileKeyMiddleware,
  fileController.getFile
)
app.post(
  '/project/:project_id/public/:public_file_id',
  keyBuilder.publicFileKeyMiddleware,
  fileController.insertFile
)
app.put(
  '/project/:project_id/public/:public_file_id',
  keyBuilder.publicFileKeyMiddleware,
  bodyParser.json(),
  fileController.copyFile
)
app.delete(
  '/project/:project_id/public/:public_file_id',
  keyBuilder.publicFileKeyMiddleware,
  fileController.deleteFile
)

app.get(
  '/project/:project_id/size',
  keyBuilder.publicProjectKeyMiddleware,
  fileController.directorySize
)

app.get(
  '/bucket/:bucket/key/*',
  keyBuilder.bucketFileKeyMiddleware,
  fileController.getFile
)

app.get('/status', function (req, res) {
  res.send('filestore sharelatex up')
})

app.get('/health_check', healthCheckController.check)

app.use(RequestLogger.errorHandler)

const port = settings.internal.filestore.port || 3009
const host = settings.internal.filestore.host || '0.0.0.0'

if (!module.parent) {
  // Called directly
  app.listen(port, host, error => {
    if (error) {
      logger.error('Error starting Filestore', error)
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

module.exports = app
