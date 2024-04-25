// Metrics must be initialized before importing anything else
require('@overleaf/metrics/initialize')

const metrics = require('@overleaf/metrics')
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
logger.initialize('notifications')
const express = require('express')
const app = express()
const methodOverride = require('method-override')
const bodyParser = require('body-parser')
const { mongoClient } = require('./app/js/mongodb')
const controller = require('./app/js/NotificationsController')

metrics.memory.monitor(logger)
metrics.open_sockets.monitor()

const HealthCheckController = require('./app/js/HealthCheckController')

app.use(methodOverride())
app.use(bodyParser())
app.use(metrics.http.monitor(logger))

metrics.injectMetricsRoute(app)

app.post('/user/:user_id', controller.addNotification)
app.get('/user/:user_id', controller.getUserNotifications)
app.delete(
  '/user/:user_id/notification/:notification_id',
  controller.removeNotificationId
)
app.delete('/user/:user_id', controller.removeNotificationKey)
app.delete('/key/:key', controller.removeNotificationByKeyOnly)
app.get('/key/:key/count', controller.countNotificationsByKeyOnly)
app.delete('/key/:key/bulk', controller.deleteUnreadNotificationsByKeyOnlyBulk)

app.get('/status', (req, res) => res.send('notifications is up'))

app.get('/health_check', (req, res) =>
  HealthCheckController.check(function (err) {
    if (err) {
      logger.err({ err }, 'error performing health check')
      res.sendStatus(500)
    } else {
      res.sendStatus(200)
    }
  })
)

app.get('*', (req, res) => res.sendStatus(404))

const host = Settings.internal?.notifications?.host || '127.0.0.1'
const port = Settings.internal?.notifications?.port || 3042

mongoClient
  .connect()
  .then(() => {
    app.listen(port, host, () =>
      logger.debug(`notifications starting up, listening on ${host}:${port}`)
    )
  })
  .catch(err => {
    logger.fatal({ err }, 'Cannot connect to mongo. Exiting.')
    process.exit(1)
  })
