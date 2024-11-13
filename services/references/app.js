import '@overleaf/metrics/initialize.js'

import express from 'express'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import metrics from '@overleaf/metrics'
import ReferencesAPIController from './app/js/ReferencesAPIController.js'
import bodyParser from 'body-parser'

const app = express()
metrics.injectMetricsRoute(app)

app.use(bodyParser.json({ limit: '2mb' }))
app.use(metrics.http.monitor(logger))

app.post('/project/:project_id/index', ReferencesAPIController.index)
app.get('/status', (req, res) => res.send({ status: 'references api is up' }))

const settings =
  Settings.internal && Settings.internal.references
    ? Settings.internal.references
    : undefined
const host = settings && settings.host ? settings.host : 'localhost'
const port = settings && settings.port ? settings.port : 3006

logger.debug('Listening at', { host, port })

const server = app.listen(port, host, function (error) {
  if (error) {
    throw error
  }
  logger.info({ host, port }, 'references HTTP server starting up')
})

process.on('SIGTERM', () => {
  server.close(() => {
    logger.info({ host, port }, 'references HTTP server closed')
    metrics.close()
  })
})
