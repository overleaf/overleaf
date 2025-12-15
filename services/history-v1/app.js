'use strict'

/* eslint-disable no-console */

// Metrics must be initialized before importing anything else
require('@overleaf/metrics/initialize')

const config = require('config')
const Events = require('node:events')
const express = require('express')
const helmet = require('helmet')
const HTTPStatus = require('http-status')
const logger = require('@overleaf/logger')
const Metrics = require('@overleaf/metrics')
const bodyParser = require('body-parser')
const security = require('./api/middleware/security')
const healthChecks = require('./api/controllers/health_checks')
const { mongodb, loadGlobalBlobs } = require('./storage')
const projectsRoutes = require('./api/routes/projects')
const projectImportRoutes = require('./api/routes/project_import')
const { createHandleValidationError } = require('@overleaf/validation-tools')

Events.setMaxListeners(20)
const app = express()
module.exports = app

const handleValidationError = createHandleValidationError(
  HTTPStatus.UNPROCESSABLE_ENTITY
)

logger.initialize('history-v1')
Metrics.open_sockets.monitor()
Metrics.injectMetricsRoute(app)
app.use(Metrics.http.monitor(logger))
Metrics.leaked_sockets.monitor(logger)

// We may have fairly large JSON bodies when receiving large Changes. Clients
// may have to handle 413 status codes and try creating files instead of sending
// text content in changes.
app.use(bodyParser.json({ limit: '12MB' }))
app.use(
  bodyParser.urlencoded({
    extended: false,
  })
)

security.setupSSL(app)
security.setupBasicHttpAuthForSwaggerDocs(app)

const HTTP_REQUEST_TIMEOUT = parseInt(config.get('httpRequestTimeout'), 10)
app.use(function (req, res, next) {
  res.setTimeout(HTTP_REQUEST_TIMEOUT)
  next()
})

app.get('/', function (req, res) {
  res.send('')
})

app.get('/status', healthChecks.status)
app.get('/health_check', healthChecks.healthCheck)

app.get('/docs', function (req, res) {
  res.send('OK')
})

function setupErrorHandling() {
  app.use(function (req, res, next) {
    const err = new Error('Not Found')
    err.status = HTTPStatus.NOT_FOUND
    return next(err)
  })

  app.use(handleValidationError)

  app.use(function (err, req, res, next) {
    const projectId = req.params?.project_id || req.body?.projectId
    logger.error({ err, projectId }, err.message)

    if (res.headersSent) {
      return next(err)
    }

    // Handle errors that specify a statusCode. Some come from our code. Some
    // bubble up from AWS SDK, but they sometimes have the statusCode set to
    // 200, notably some InternalErrors and TimeoutErrors, so we have to guard
    // against that. We also check `status`, but `statusCode` is preferred.
    const statusCode = err.statusCode || err.status
    if (err.headers) {
      res.set(err.headers)
    }

    if (statusCode && statusCode >= 400 && statusCode < 600) {
      res.status(statusCode)
    } else {
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR)
    }

    const sendErrorToClient = app.get('env') === 'development'
    res.json({
      message: err.message,
      error: sendErrorToClient ? err : {},
    })
  })
}

app.setup = async function appSetup() {
  await mongodb.client.connect()
  logger.info('Connected to MongoDB')
  await loadGlobalBlobs()
  logger.info('Global blobs loaded')
  app.use(helmet())
  app.use('/api', projectsRoutes)
  app.use('/api', projectImportRoutes)
  setupErrorHandling()
}

async function startApp() {
  await app.setup()

  const port = parseInt(process.env.PORT, 10) || 3100
  app.listen(port, err => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    Metrics.event_loop.monitor(logger)
    Metrics.memory.monitor(logger)
  })
}

// Run this if we're called directly
if (!module.parent) {
  startApp().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
