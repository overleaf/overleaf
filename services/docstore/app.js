/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Metrics = require('metrics-sharelatex')
Metrics.initialize('docstore')
const Settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const express = require('express')
const bodyParser = require('body-parser')
const Errors = require('./app/js/Errors')
const HttpController = require('./app/js/HttpController')

logger.initialize('docstore')
if (Metrics.event_loop != null) {
  Metrics.event_loop.monitor(logger)
}

const app = express()

app.use(Metrics.http.monitor(logger))

Metrics.injectMetricsRoute(app)

app.param('project_id', function (req, res, next, projectId) {
  if (projectId != null ? projectId.match(/^[0-9a-f]{24}$/) : undefined) {
    return next()
  } else {
    return next(new Error('invalid project id'))
  }
})

app.param('doc_id', function (req, res, next, docId) {
  if (docId != null ? docId.match(/^[0-9a-f]{24}$/) : undefined) {
    return next()
  } else {
    return next(new Error('invalid doc id'))
  }
})

Metrics.injectMetricsRoute(app)

app.get('/project/:project_id/doc', HttpController.getAllDocs)
app.get('/project/:project_id/ranges', HttpController.getAllRanges)
app.get('/project/:project_id/doc/:doc_id', HttpController.getDoc)
app.get('/project/:project_id/doc/:doc_id/raw', HttpController.getRawDoc)
// Add 64kb overhead for the JSON encoding, and double the size to allow for ranges in the json payload
app.post(
  '/project/:project_id/doc/:doc_id',
  bodyParser.json({ limit: (Settings.max_doc_length + 64 * 1024) * 2 }),
  HttpController.updateDoc
)
app.del('/project/:project_id/doc/:doc_id', HttpController.deleteDoc)

app.post('/project/:project_id/archive', HttpController.archiveAllDocs)
app.post('/project/:project_id/unarchive', HttpController.unArchiveAllDocs)
app.post('/project/:project_id/destroy', HttpController.destroyAllDocs)

app.get('/health_check', HttpController.healthCheck)

app.get('/status', (req, res) => res.send('docstore is alive'))

app.use(function (error, req, res, next) {
  logger.error({ err: error, req }, 'request errored')
  if (error instanceof Errors.NotFoundError) {
    return res.send(404)
  } else {
    return res.send(500, 'Oops, something went wrong')
  }
})

const { port } = Settings.internal.docstore
const { host } = Settings.internal.docstore

if (!module.parent) {
  // Called directly
  app.listen(port, host, function (error) {
    if (error != null) {
      throw error
    }
    return logger.info(`Docstore starting up, listening on ${host}:${port}`)
  })
}

module.exports = app
