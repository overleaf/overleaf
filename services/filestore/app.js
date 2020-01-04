const Metrics = require('metrics-sharelatex')
const logger = require('logger-sharelatex')

Metrics.initialize('filestore')
logger.initialize('filestore')

const settings = require('settings-sharelatex')
const express = require('express')
const bodyParser = require('body-parser')

const fileController = require('./app/js/FileController')
const bucketController = require('./app/js/BucketController')
const keyBuilder = require('./app/js/KeyBuilder')
const healthCheckController = require('./app/js/HealthCheckController')
const ExceptionHandler = require('./app/js/ExceptionHandler')
const exceptionHandler = new ExceptionHandler()

const app = express()
app.exceptionHandler = exceptionHandler

if (settings.sentry && settings.sentry.dsn) {
  logger.initializeErrorReporting(settings.sentry.dsn)
}

Metrics.open_sockets.monitor(logger)
Metrics.memory.monitor(logger)
if (Metrics.event_loop) {
  Metrics.event_loop.monitor(logger)
}

app.use(Metrics.http.monitor(logger))
app.use(function(req, res, next) {
  Metrics.inc('http-request')
  next()
})

exceptionHandler.addMiddleware(app)

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

app.get('/bucket/:bucket/key/*', bucketController.getFile)

app.get('/heapdump', (req, res, next) =>
  require('heapdump').writeSnapshot(
    '/tmp/' + Date.now() + '.filestore.heapsnapshot',
    (err, filename) => {
      if (err) {
        return next(err)
      }
      res.send(filename)
    }
  )
)

app.post('/shutdown', function(req, res) {
  exceptionHandler.setNotOk()
  res.sendStatus(200)
})

app.get('/status', function(req, res) {
  if (exceptionHandler.appIsOk()) {
    res.send('filestore sharelatex up')
  } else {
    logger.log('app is not ok - shutting down')
    res.status(500).send('server is being shut down')
  }
})

app.get('/health_check', healthCheckController.check)

app.get('*', (req, res) => res.sendStatus(404))

const port = settings.internal.filestore.port || 3009
const host = '0.0.0.0'

if (!module.parent) {
  // Called directly
  const server = app.listen(port, host, error => {
    if (error) {
      logger.error('Error starting Filestore', error)
      throw error
    }
    logger.info(`Filestore starting up, listening on ${host}:${port}`)
  })
  exceptionHandler.server = server
}

module.exports = app

process.on('SIGTERM', function() {
  logger.log('filestore got SIGTERM, shutting down gracefully')
  exceptionHandler.beginShutdown()
})

if (global.gc) {
  const oneMinute = 60 * 1000
  const gcTimer = setInterval(function() {
    global.gc()
    logger.log(process.memoryUsage(), 'global.gc')
  }, 3 * oneMinute)
  gcTimer.unref()
}
