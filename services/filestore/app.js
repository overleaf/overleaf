/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Metrics = require('metrics-sharelatex')
Metrics.initialize('filestore')
const express = require('express')
const bodyParser = require('body-parser')
let logger = require('logger-sharelatex')
logger.initialize('filestore')
const settings = require('settings-sharelatex')
const request = require('request')
const fileController = require('./app/js/FileController')
const bucketController = require('./app/js/BucketController')
const keyBuilder = require('./app/js/KeyBuilder')
const healthCheckController = require('./app/js/HealthCheckController')
const domain = require('domain')
let appIsOk = true
const app = express()

if ((settings.sentry != null ? settings.sentry.dsn : undefined) != null) {
  logger.initializeErrorReporting(settings.sentry.dsn)
}

Metrics.open_sockets.monitor(logger)
if (Metrics.event_loop != null) {
  Metrics.event_loop.monitor(logger)
}
Metrics.memory.monitor(logger)

app.use(Metrics.http.monitor(logger))

app.use(function(req, res, next) {
  Metrics.inc('http-request')
  return next()
})

app.use(function(req, res, next) {
  const requestDomain = domain.create()
  requestDomain.add(req)
  requestDomain.add(res)
  requestDomain.on('error', function(err) {
    try {
      // request a shutdown to prevent memory leaks
      beginShutdown()
      if (!res.headerSent) {
        res.send(500, 'uncaught exception')
      }
      logger = require('logger-sharelatex')
      req = {
        body: req.body,
        headers: req.headers,
        url: req.url,
        key: req.key,
        statusCode: req.statusCode
      }
      err = {
        message: err.message,
        stack: err.stack,
        name: err.name,
        type: err.type,
        arguments: err.arguments
      }
      return logger.err(
        { err, req, res },
        'uncaught exception thrown on request'
      )
    } catch (exception) {
      return logger.err(
        { err: exception },
        'exception in request domain handler'
      )
    }
  })
  return requestDomain.run(next)
})

app.use(function(req, res, next) {
  if (!appIsOk) {
    // when shutting down, close any HTTP keep-alive connections
    res.set('Connection', 'close')
  }
  return next()
})

Metrics.injectMetricsRoute(app)

app.head(
  '/project/:project_id/file/:file_id',
  keyBuilder.userFileKey,
  fileController.getFileHead
)
app.get(
  '/project/:project_id/file/:file_id',
  keyBuilder.userFileKey,
  fileController.getFile
)
app.post(
  '/project/:project_id/file/:file_id',
  keyBuilder.userFileKey,
  fileController.insertFile
)
app.put(
  '/project/:project_id/file/:file_id',
  keyBuilder.userFileKey,
  bodyParser.json(),
  fileController.copyFile
)
app.del(
  '/project/:project_id/file/:file_id',
  keyBuilder.userFileKey,
  fileController.deleteFile
)

app.head(
  '/template/:template_id/v/:version/:format',
  keyBuilder.templateFileKey,
  fileController.getFileHead
)
app.get(
  '/template/:template_id/v/:version/:format',
  keyBuilder.templateFileKey,
  fileController.getFile
)
app.get(
  '/template/:template_id/v/:version/:format/:sub_type',
  keyBuilder.templateFileKey,
  fileController.getFile
)
app.post(
  '/template/:template_id/v/:version/:format',
  keyBuilder.templateFileKey,
  fileController.insertFile
)

app.head(
  '/project/:project_id/public/:public_file_id',
  keyBuilder.publicFileKey,
  fileController.getFileHead
)
app.get(
  '/project/:project_id/public/:public_file_id',
  keyBuilder.publicFileKey,
  fileController.getFile
)
app.post(
  '/project/:project_id/public/:public_file_id',
  keyBuilder.publicFileKey,
  fileController.insertFile
)
app.put(
  '/project/:project_id/public/:public_file_id',
  keyBuilder.publicFileKey,
  bodyParser.json(),
  fileController.copyFile
)
app.del(
  '/project/:project_id/public/:public_file_id',
  keyBuilder.publicFileKey,
  fileController.deleteFile
)

app.get(
  '/project/:project_id/size',
  keyBuilder.publicProjectKey,
  fileController.directorySize
)

app.get('/bucket/:bucket/key/*', bucketController.getFile)

app.get('/heapdump', (req, res) =>
  require('heapdump').writeSnapshot(
    '/tmp/' + Date.now() + '.filestore.heapsnapshot',
    (err, filename) => res.send(filename)
  )
)

app.post('/shutdown', function(req, res) {
  appIsOk = false
  return res.send()
})

app.get('/status', function(req, res) {
  if (appIsOk) {
    return res.send('filestore sharelatex up')
  } else {
    logger.log('app is not ok - shutting down')
    return res.send('server is being shut down', 500)
  }
})

app.get('/health_check', healthCheckController.check)

app.get('*', (req, res) => res.send(404))

var beginShutdown = function() {
  if (appIsOk) {
    appIsOk = false
    // hard-terminate this process if graceful shutdown fails
    const killTimer = setTimeout(() => process.exit(1), 120 * 1000)
    if (typeof killTimer.unref === 'function') {
      killTimer.unref()
    } // prevent timer from keeping process alive
    server.close(function() {
      logger.log('closed all connections')
      Metrics.close()
      return typeof process.disconnect === 'function'
        ? process.disconnect()
        : undefined
    })
    return logger.log('server will stop accepting connections')
  }
}

const port = settings.internal.filestore.port || 3009
const host = '0.0.0.0'

if (!module.parent) {
  // Called directly
  var server = app.listen(port, host, error =>
    logger.info(`Filestore starting up, listening on ${host}:${port}`)
  )
}

module.exports = app

process.on('SIGTERM', function() {
  logger.log('filestore got SIGTERM, shutting down gracefully')
  return beginShutdown()
})

if (global.gc != null) {
  let oneMinute
  const gcTimer = setInterval(function() {
    global.gc()
    return logger.log(process.memoryUsage(), 'global.gc')
  }, 3 * (oneMinute = 60 * 1000))
  gcTimer.unref()
}
