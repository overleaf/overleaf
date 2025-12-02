// Metrics must be initialized before importing anything else
import '@overleaf/metrics/initialize.js'

import Events from 'node:events'
import Metrics from '@overleaf/metrics'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import express from 'express'
import bodyParser from 'body-parser'
import {
  celebrate as validate,
  Joi,
  errors as handleValidationErrors,
} from 'celebrate'
import mongodb from './app/js/mongodb.js'
import Errors from './app/js/Errors.js'
import HttpController from './app/js/HttpController.js'

const { mongoClient } = mongodb

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
app.get(
  '/project/:project_id/comment-thread-ids',
  HttpController.getCommentThreadIds
)
app.get(
  '/project/:project_id/tracked-changes-user-ids',
  HttpController.getTrackedChangesUserIds
)
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
  if (error instanceof Errors.NotFoundError) {
    logger.warn({ req }, 'not found')
    res.sendStatus(404)
  } else if (error instanceof Errors.DocModifiedError) {
    logger.warn({ req }, 'conflict: doc modified')
    res.sendStatus(409)
  } else if (error instanceof Errors.DocVersionDecrementedError) {
    logger.warn({ req }, 'conflict: doc version decremented')
    res.sendStatus(409)
  } else {
    logger.error({ err: error, req }, 'request errored')
    res.status(500).send('Oops, something went wrong')
  }
})

const { port } = Settings.internal.docstore
const { host } = Settings.internal.docstore

if (import.meta.main) {
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

export default app
