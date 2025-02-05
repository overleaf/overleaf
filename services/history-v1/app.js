'use strict'

/* eslint-disable no-console */

// Metrics must be initialized before importing anything else
require('@overleaf/metrics/initialize')

const config = require('config')
const Events = require('node:events')
const BPromise = require('bluebird')
const express = require('express')
const helmet = require('helmet')
const HTTPStatus = require('http-status')
const logger = require('@overleaf/logger')
const Metrics = require('@overleaf/metrics')
const bodyParser = require('body-parser')
const swaggerTools = require('swagger-tools')
const swaggerDoc = require('./api/swagger')
const security = require('./api/app/security')
const healthChecks = require('./api/controllers/health_checks')
const { mongodb, loadGlobalBlobs } = require('./storage')
const path = require('node:path')

Events.setMaxListeners(20)
const app = express()
module.exports = app

logger.initialize('history-v1')
Metrics.open_sockets.monitor()
Metrics.injectMetricsRoute(app)
app.use(Metrics.http.monitor(logger))
Metrics.leaked_sockets.monitor(logger)

// We may have fairly large JSON bodies when receiving large Changes. Clients
// may have to handle 413 status codes and try creating files instead of sending
// text content in changes.
app.use(bodyParser.json({ limit: '6MB' }))
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

function setupSwagger() {
  return new BPromise(function (resolve) {
    swaggerTools.initializeMiddleware(swaggerDoc, function (middleware) {
      app.use(middleware.swaggerMetadata())
      app.use(middleware.swaggerSecurity(security.getSwaggerHandlers()))
      app.use(middleware.swaggerValidator())
      app.use(
        middleware.swaggerRouter({
          controllers: path.join(__dirname, 'api/controllers'),
          useStubs: app.get('env') === 'development',
        })
      )
      app.use(middleware.swaggerUi())
      resolve()
    })
  })
}

function setupErrorHandling() {
  app.use(function (req, res, next) {
    const err = new Error('Not Found')
    err.status = HTTPStatus.NOT_FOUND
    return next(err)
  })

  // Handle Swagger errors.
  app.use(function (err, req, res, next) {
    const projectId = req.swagger?.params?.project_id?.value
    if (res.headersSent) {
      return next(err)
    }

    if (err.code === 'SCHEMA_VALIDATION_FAILED') {
      logger.error({ err, projectId }, err.message)
      return res.status(HTTPStatus.UNPROCESSABLE_ENTITY).json(err.results)
    }
    if (err.code === 'INVALID_TYPE' || err.code === 'PATTERN') {
      logger.error({ err, projectId }, err.message)
      return res.status(HTTPStatus.UNPROCESSABLE_ENTITY).json({
        message: 'invalid type: ' + err.paramName,
      })
    }
    if (err.code === 'ENUM_MISMATCH') {
      return res.status(HTTPStatus.UNPROCESSABLE_ENTITY).json({
        message: 'invalid enum value: ' + err.paramName,
      })
    }
    if (err.code === 'REQUIRED') {
      return res.status(HTTPStatus.UNPROCESSABLE_ENTITY).json({
        message: err.message,
      })
    }
    next(err)
  })

  app.use(function (err, req, res, next) {
    const projectId = req.swagger?.params?.project_id?.value
    logger.error({ err, projectId }, err.message)

    if (res.headersSent) {
      return next(err)
    }

    // Handle errors that specify a statusCode. Some come from our code. Some
    // bubble up from AWS SDK, but they sometimes have the statusCode set to
    // 200, notably some InternalErrors and TimeoutErrors, so we have to guard
    // against that. We also check `status`, but `statusCode` is preferred.
    const statusCode = err.statusCode || err.status
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
  await setupSwagger()
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
