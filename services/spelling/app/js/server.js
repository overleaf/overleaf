import metrics from '@overleaf/metrics'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import express from 'express'
import bodyParser from 'body-parser'
import * as SpellingAPIController from './SpellingAPIController.js'
import * as HealthCheckController from './HealthCheckController.js'

metrics.initialize('spelling')
logger.initialize('spelling')
if (Settings.sentry?.dsn != null) {
  logger.initializeErrorReporting(Settings.sentry.dsn)
}
metrics.memory.monitor(logger)
metrics.leaked_sockets.monitor(logger)
metrics.open_sockets.monitor()

export const app = express()

metrics.injectMetricsRoute(app)

app.use(bodyParser.json({ limit: '2mb' }))
app.use(metrics.http.monitor(logger))

app.post('/user/:user_id/check', SpellingAPIController.check)
app.get('/status', (req, res) => res.send({ status: 'spelling api is up' }))

app.get('/health_check', HealthCheckController.healthCheck)
