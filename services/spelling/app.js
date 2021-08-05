/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const metrics = require('@overleaf/metrics')
metrics.initialize('spelling')

const Settings = require('@overleaf/settings')
const logger = require('logger-sharelatex')
logger.initialize('spelling')
if ((Settings.sentry != null ? Settings.sentry.dsn : undefined) != null) {
  logger.initializeErrorReporting(Settings.sentry.dsn)
}
metrics.memory.monitor(logger)

const mongodb = require('./app/js/mongodb')
const SpellingAPIController = require('./app/js/SpellingAPIController')
const express = require('express')
const app = express()
metrics.injectMetricsRoute(app)
const bodyParser = require('body-parser')
const HealthCheckController = require('./app/js/HealthCheckController')

app.use(bodyParser.json({ limit: '2mb' }))
app.use(metrics.http.monitor(logger))

app.delete('/user/:user_id', SpellingAPIController.deleteDic)
app.get('/user/:user_id', SpellingAPIController.getDic)
app.post('/user/:user_id/check', SpellingAPIController.check)
app.post('/user/:user_id/learn', SpellingAPIController.learn)
app.post('/user/:user_id/unlearn', SpellingAPIController.unlearn)
app.get('/status', (req, res) => res.send({ status: 'spelling api is up' }))

app.get('/health_check', HealthCheckController.healthCheck)

const settings =
  Settings.internal && Settings.internal.spelling
    ? Settings.internal.spelling
    : undefined
const host = settings && settings.host ? settings.host : 'localhost'
const port = settings && settings.port ? settings.port : 3005

if (!module.parent) {
  // application entry point, called directly
  mongodb
    .waitForDb()
    .then(() => {
      app.listen(port, host, function (error) {
        if (error != null) {
          throw error
        }
        return logger.info(`spelling starting up, listening on ${host}:${port}`)
      })
    })
    .catch(err => {
      logger.fatal({ err }, 'Cannot connect to mongo. Exiting.')
      process.exit(1)
    })
}

module.exports = app
