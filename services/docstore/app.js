// Metrics must be initialized before importing anything else
require('@overleaf/metrics/initialize')

const Events = require('node:events')
const Metrics = require('@overleaf/metrics')
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const express = require('express')
const bodyParser = require('body-parser')
const {
  celebrate: validate,
  Joi,
  errors: handleValidationErrors,
} = require('celebrate')
const { mongoClient } = require('./app/js/mongodb')
const Errors = require('./app/js/Errors')
const HttpController = require('./app/js/HttpController')

Events.setMaxListeners(20)

logger.initialize('docstore')
if (Metrics.event_loop != null) {
  Metrics.event_loop.monitor(logger)
}
Metrics.leaked_sockets.monitor(logger)
Metrics.open_sockets.monitor()

const app = express()

app.use(Metrics.http.monitor(logger))

Metrics.injectMetricsRoute(app)

app.param('project_id', function (req, res, next, projectId) {
  if (projectId?.match(/^[0-9a-f]{24}$/)) {
    next()
  } else {
    next(new Error('invalid project id'))
  }
})

app.param('doc_id', function (req, res, next, docId) {
  if (docId?.match(/^[0-9a-f]{24}$/)) {
    next()
  } else {
    next(new Error('invalid doc id'))
  }
})

app.get('/project/:project_id/doc-deleted', HttpController.getAllDeletedDocs)
app.get('/project/:project_id/doc', HttpController.getAllDocs)
app.get('/project/:project_id/ranges', HttpController.getAllRanges)
app.get('/project/:project_id/has-ranges', HttpController.projectHasRanges)
app.get('/project/:project_id/doc/:doc_id', HttpController.getDoc)
app.get('/project/:project_id/doc/:doc_id/deleted', HttpController.isDocDeleted)
app.get('/project/:project_id/doc/:doc_id/raw', HttpController.getRawDoc)
app.get('/project/:project_id/doc/:doc_id/peek', HttpController.peekDoc)
// Add 64kb overhead for the JSON encoding, and double the size to allow for ranges in the json payload
app.post(
  '/project/:project_id/doc/:doc_id',
  bodyParser.json({ limit: Settings.maxJsonRequestSize }),
  HttpController.updateDoc
)
app.patch(
  '/project/:project_id/doc/:doc_id',
  bodyParser.json(),
  validate({
    body: {
      deleted: Joi.boolean(),
      name: Joi.string().when('deleted', { is: true, then: Joi.required() }),
      deletedAt: Joi.date().when('deleted', { is: true, then: Joi.required() }),
    },
  }),
  HttpController.patchDoc
)
app.delete('/project/:project_id/doc/:doc_id', (req, res) => {
  res.status(500).send('DELETE-ing a doc is DEPRECATED. PATCH the doc instead.')
})

app.post('/project/:project_id/archive', HttpController.archiveAllDocs)
app.post('/project/:project_id/doc/:doc_id/archive', HttpController.archiveDoc)
app.post('/project/:project_id/unarchive', HttpController.unArchiveAllDocs)
app.post('/project/:project_id/destroy', HttpController.destroyProject)

app.get('/health_check', HttpController.healthCheck)

app.get('/status', (req, res) => res.send('docstore is alive'))

app.use(handleValidationErrors())
app.use(function (error, req, res, next) {
  logger.error({ err: error, req }, 'request errored')
  if (error instanceof Errors.NotFoundError) {
    res.sendStatus(404)
  } else if (error instanceof Errors.DocModifiedError) {
    res.sendStatus(409)
  } else if (error instanceof Errors.DocVersionDecrementedError) {
    res.sendStatus(409)
  } else {
    res.status(500).send('Oops, something went wrong')
  }
})

const { port } = Settings.internal.docstore
const { host } = Settings.internal.docstore

if (!module.parent) {
  // Called directly
  mongoClient
    .connect()
    .then(() => {
      const server = app.listen(port, host, function (err) {
        if (err) {
          logger.fatal({ err }, `Cannot bind to ${host}:${port}. Exiting.`)
          process.exit(1)
        }
        logger.debug(`Docstore starting up, listening on ${host}:${port}`)
      })
      server.timeout = 120000
      server.keepAliveTimeout = 5000
      server.requestTimeout = 60000
      server.headersTimeout = 60000
    })
    .catch(err => {
      logger.fatal({ err }, 'Cannot connect to mongo. Exiting.')
      process.exit(1)
    })
}

module.exports = app
