/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const metrics = require('metrics-sharelatex')
metrics.initialize('notifications')
const Settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
logger.initialize('notifications-sharelatex')
const express = require('express')
const app = express()
const methodOverride = require('method-override')
const bodyParser = require('body-parser')
const errorHandler = require('errorhandler')
const mongodb = require('./app/js/mongodb')
const controller = require('./app/js/NotificationsController')

metrics.memory.monitor(logger)

const HealthCheckController = require('./app/js/HealthCheckController')

app.use(methodOverride())
app.use(bodyParser())
app.use(metrics.http.monitor(logger))
app.use(errorHandler())

metrics.injectMetricsRoute(app)

app.post('/user/:user_id', controller.addNotification)
app.get('/user/:user_id', controller.getUserNotifications)
app.delete(
  '/user/:user_id/notification/:notification_id',
  controller.removeNotificationId
)
app.delete('/user/:user_id', controller.removeNotificationKey)
app.delete('/key/:key', controller.removeNotificationByKeyOnly)

app.get('/status', (req, res) => res.send('notifications sharelatex up'))

app.get('/health_check', (req, res) =>
  HealthCheckController.check(function (err) {
    if (err != null) {
      logger.err({ err }, 'error performing health check')
      return res.sendStatus(500)
    } else {
      return res.sendStatus(200)
    }
  })
)

app.get('*', (req, res) => res.sendStatus(404))

const host =
  __guard__(
    Settings.internal != null ? Settings.internal.notifications : undefined,
    (x) => x.host
  ) || 'localhost'
const port =
  __guard__(
    Settings.internal != null ? Settings.internal.notifications : undefined,
    (x1) => x1.port
  ) || 3042

mongodb
  .waitForDb()
  .then(() => {
    app.listen(port, host, () =>
      logger.info(`notifications starting up, listening on ${host}:${port}`)
    )
  })
  .catch((err) => {
    logger.fatal({ err }, 'Cannot connect to mongo. Exiting.')
    process.exit(1)
  })

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
