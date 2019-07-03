/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const metrics = require('metrics-sharelatex')
metrics.initialize('spelling')

const Settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
logger.initialize('spelling')
if ((Settings.sentry != null ? Settings.sentry.dsn : undefined) != null) {
  logger.initializeErrorReporting(Settings.sentry.dsn)
}
metrics.memory.monitor(logger)

const SpellingAPIController = require('./app/js/SpellingAPIController')
const express = require('express')
const server = express()
metrics.injectMetricsRoute(server)
const bodyParser = require('body-parser')
const HealthCheckController = require('./app/js/HealthCheckController')

server.use(bodyParser.json({ limit: '2mb' }))
server.use(metrics.http.monitor(logger))

server.del('/user/:user_id', SpellingAPIController.deleteDic)
server.get('/user/:user_id', SpellingAPIController.getDic)
server.post('/user/:user_id/check', SpellingAPIController.check)
server.post('/user/:user_id/learn', SpellingAPIController.learn)
server.get('/status', (req, res) => res.send({ status: 'spelling api is up' }))

server.get('/health_check', HealthCheckController.healthCheck)

const profiler = require('v8-profiler')
server.get('/profile', function(req, res) {
  const time = parseInt(req.query.time || '1000')
  profiler.startProfiling('test')
  return setTimeout(function() {
    const profile = profiler.stopProfiling('test')
    return res.json(profile)
  }, time)
})

const host =
  __guard__(
    Settings.internal != null ? Settings.internal.spelling : undefined,
    x => x.host
  ) || 'localhost'
const port =
  __guard__(
    Settings.internal != null ? Settings.internal.spelling : undefined,
    x1 => x1.port
  ) || 3005
server.listen(port, host, function(error) {
  if (error != null) {
    throw error
  }
  return logger.info(`spelling starting up, listening on ${host}:${port}`)
})

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
