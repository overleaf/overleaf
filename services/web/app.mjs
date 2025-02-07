// Metrics must be initialized before importing anything else
import '@overleaf/metrics/initialize.js'

import Modules from './app/src/infrastructure/Modules.js'
import metrics from '@overleaf/metrics'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import PlansLocator from './app/src/Features/Subscription/PlansLocator.js'
import HistoryManager from './app/src/Features/History/HistoryManager.js'
import SiteAdminHandler from './app/src/infrastructure/SiteAdminHandler.js'
import http from 'node:http'
import https from 'node:https'
import * as Serializers from './app/src/infrastructure/LoggerSerializers.js'
import Server from './app/src/infrastructure/Server.mjs'
import QueueWorkers from './app/src/infrastructure/QueueWorkers.js'
import mongodb from './app/src/infrastructure/mongodb.js'
import mongoose from './app/src/infrastructure/Mongoose.js'
import { triggerGracefulShutdown } from './app/src/infrastructure/GracefulShutdown.js'
import FileWriter from './app/src/infrastructure/FileWriter.js'
import { fileURLToPath } from 'node:url'
import Features from './app/src/infrastructure/Features.js'

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

if (
  !Features.hasFeature('project-history-blobs') &&
  !Features.hasFeature('filestore')
) {
  throw new Error(
    'invalid config: must enable either project-history-blobs (Settings.enableProjectHistoryBlobs=true) or enable filestore (Settings.disableFilestore=false)'
  )
}

const port = Settings.port || Settings.internal.web.port || 3000
const host = Settings.internal.web.host || '127.0.0.1'
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Called directly
  // We want to make sure that we provided a password through the environment.
  if (!process.env.WEB_API_USER || !process.env.WEB_API_PASSWORD) {
    throw new Error('No API user and password provided')
  }

  PlansLocator.ensurePlansAreSetupCorrectly()

  Promise.all([
    mongodb.connectionPromise,
    mongoose.connectionPromise,
    HistoryManager.promises.loadGlobalBlobs(),
  ])
    .then(async () => {
      Server.server.listen(port, host, function () {
        logger.debug(`web starting up, listening on ${host}:${port}`)
        logger.debug(`${http.globalAgent.maxSockets} sockets enabled`)
        // wait until the process is ready before monitoring the event loop
        metrics.event_loop.monitor(logger)
      })
      QueueWorkers.start()
      await Modules.start()
    })
    .catch(err => {
      logger.fatal({ err }, 'Cannot connect to mongo. Exiting.')
      process.exit(1)
    })
}

// initialise site admin tasks
Promise.all([
  mongodb.connectionPromise,
  mongoose.connectionPromise,
  HistoryManager.promises.loadGlobalBlobs(),
])
  .then(() => SiteAdminHandler.initialise())
  .catch(err => {
    logger.fatal({ err }, 'Cannot connect to mongo. Exiting.')
    process.exit(1)
  })

// handle SIGTERM for graceful shutdown in kubernetes
process.on('SIGTERM', function (signal) {
  triggerGracefulShutdown(Server.server, signal)
})

export default Server.server
