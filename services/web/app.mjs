// Metrics must be initialized before importing anything else
import { metricsModuleImportStartTime } from '@overleaf/metrics/initialize.js'

import Modules from './app/src/infrastructure/Modules.mjs'
import metrics from '@overleaf/metrics'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import PlansLocator from './app/src/Features/Subscription/PlansLocator.mjs'
import HistoryManager from './app/src/Features/History/HistoryManager.mjs'
import SiteAdminHandler from './app/src/infrastructure/SiteAdminHandler.mjs'
import http from 'node:http'
import https from 'node:https'
import Serializers from './app/src/infrastructure/LoggerSerializers.mjs'
import Server from './app/src/infrastructure/Server.mjs'
import QueueWorkers from './app/src/infrastructure/QueueWorkers.mjs'
import mongodb from './app/src/infrastructure/mongodb.mjs'
import mongoose from './app/src/infrastructure/Mongoose.mjs'
import { triggerGracefulShutdown } from './app/src/infrastructure/GracefulShutdown.mjs'
import FileWriter from './app/src/infrastructure/FileWriter.mjs'
import { fileURLToPath } from 'node:url'

metrics.gauge(
  'web_startup',
  performance.now() - metricsModuleImportStartTime,
  1,
  { path: 'imports' }
)

logger.initialize(process.env.METRICS_APP_NAME || 'web')
logger.logger.serializers.user = Serializers.user
logger.logger.serializers.docs = Serializers.docs
logger.logger.serializers.files = Serializers.files
logger.logger.serializers.project = Serializers.project
http.globalAgent.keepAlive = false
http.globalAgent.maxSockets = Settings.limits.httpGlobalAgentMaxSockets
https.globalAgent.keepAlive = false
https.globalAgent.maxSockets = Settings.limits.httpsGlobalAgentMaxSockets

metrics.memory.monitor(logger)
metrics.leaked_sockets.monitor(logger)
metrics.open_sockets.monitor()

if (Settings.catchErrors) {
  process.removeAllListeners('uncaughtException')
  process.removeAllListeners('unhandledRejection')
  process
    .on('uncaughtException', error =>
      logger.error({ err: error }, 'uncaughtException')
    )
    .on('unhandledRejection', (reason, p) => {
      logger.error({ err: reason }, 'unhandledRejection at Promise', p)
    })
}

// Create ./data/dumpFolder if needed
FileWriter.ensureDumpFolderExists()

// handle SIGTERM for graceful shutdown in kubernetes
process.on('SIGTERM', function (signal) {
  triggerGracefulShutdown(Server.server, signal)
})

const beforeWaitForMongoAndGlobalBlobs = performance.now()
try {
  await Promise.all([
    mongodb.connectionPromise,
    mongoose.connectionPromise,
    HistoryManager.loadGlobalBlobsPromise,
  ])
} catch (err) {
  logger.fatal({ err }, 'Cannot connect to mongo. Exiting.')
  process.exit(1)
}
metrics.gauge(
  'web_startup',
  performance.now() - beforeWaitForMongoAndGlobalBlobs,
  1,
  { path: 'waitForMongoAndGlobalBlobs' }
)

const port = Settings.port || Settings.internal.web.port || 3000
const host = Settings.internal.web.host || '127.0.0.1'
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Called directly
  // We want to make sure that we provided a password through the environment.
  if (!process.env.WEB_API_USER || !process.env.WEB_API_PASSWORD) {
    throw new Error('No API user and password provided')
  }

  PlansLocator.ensurePlansAreSetupCorrectly()

  Server.server.listen(port, host, function () {
    logger.debug(`web starting up, listening on ${host}:${port}`)
    logger.debug(`${http.globalAgent.maxSockets} sockets enabled`)
    // wait until the process is ready before monitoring the event loop
    metrics.event_loop.monitor(logger)

    // Record metrics for the total startup time before listening on HTTP.
    metrics.gauge(
      'web_startup',
      performance.now() - metricsModuleImportStartTime,
      1,
      { path: 'metricsModuleImportToHTTPListen' }
    )
  })
  try {
    QueueWorkers.start()
  } catch (err) {
    logger.fatal({ err }, 'failed to start queue processing')
  }
  try {
    await Modules.start()
  } catch (err) {
    logger.fatal({ err }, 'failed to start web module background jobs')
  }
}

// initialise site admin tasks
SiteAdminHandler.initialise()

export default Server.server
