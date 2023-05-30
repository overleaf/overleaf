/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const metrics = require('@overleaf/metrics')
metrics.initialize(process.env.METRICS_APP_NAME || 'web')
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const PlansLocator = require('./app/src/Features/Subscription/PlansLocator')
const SiteAdminHandler = require('./app/src/infrastructure/SiteAdminHandler')
logger.initialize(process.env.METRICS_APP_NAME || 'web')
logger.logger.serializers.user =
  require('./app/src/infrastructure/LoggerSerializers').user
logger.logger.serializers.docs =
  require('./app/src/infrastructure/LoggerSerializers').docs
logger.logger.serializers.files =
  require('./app/src/infrastructure/LoggerSerializers').files
logger.logger.serializers.project =
  require('./app/src/infrastructure/LoggerSerializers').project
if ((Settings.sentry != null ? Settings.sentry.dsn : undefined) != null) {
  logger.initializeErrorReporting(Settings.sentry.dsn)
}

const http = require('http')
const https = require('https')
http.globalAgent.maxSockets = Settings.limits.httpGlobalAgentMaxSockets
https.globalAgent.maxSockets = Settings.limits.httpsGlobalAgentMaxSockets

metrics.memory.monitor(logger)
metrics.leaked_sockets.monitor(logger)
metrics.open_sockets.monitor()

const Server = require('./app/src/infrastructure/Server')
const QueueWorkers = require('./app/src/infrastructure/QueueWorkers')
const mongodb = require('./app/src/infrastructure/mongodb')
const mongoose = require('./app/src/infrastructure/Mongoose')
const {
  triggerGracefulShutdown,
} = require('./app/src/infrastructure/GracefulShutdown')

if (Settings.catchErrors) {
  process.removeAllListeners('uncaughtException')
  process.on('uncaughtException', error =>
    logger.error({ err: error }, 'uncaughtException')
  )
}
const port = Settings.port || Settings.internal.web.port || 3000
const host = Settings.internal.web.host || 'localhost'
if (!module.parent) {
  // Called directly

  // We want to make sure that we provided a password through the environment.
  if (!process.env.WEB_API_USER || !process.env.WEB_API_PASSWORD) {
    throw new Error('No API user and password provided')
  }

  PlansLocator.ensurePlansAreSetupCorrectly()

  Promise.all([mongodb.waitForDb(), mongoose.connectionPromise])
    .then(() => {
      Server.server.listen(port, host, function () {
        logger.debug(`web starting up, listening on ${host}:${port}`)
        logger.debug(
          `${require('http').globalAgent.maxSockets} sockets enabled`
        )
        // wait until the process is ready before monitoring the event loop
        metrics.event_loop.monitor(logger)
      })
      if (process.env.QUEUE_PROCESSING_ENABLED === 'true') {
        QueueWorkers.start()
      }
    })
    .catch(err => {
      logger.fatal({ err }, 'Cannot connect to mongo. Exiting.')
      process.exit(1)
    })
}

// monitor site maintenance file
SiteAdminHandler.initialise()

// handle SIGTERM for graceful shutdown in kubernetes
process.on('SIGTERM', function (signal) {
  triggerGracefulShutdown(Server.server, signal)
})

module.exports = Server.server
