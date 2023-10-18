// Metrics must be initialized before importing anything else
import '@overleaf/metrics/initialize.js'

import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'
import { mongoClient } from './app/js/mongodb.js'
import { app } from './app/js/server.js'

const { host, port } = Settings.internal.contacts

try {
  await mongoClient.connect()
} catch (err) {
  logger.fatal({ err }, 'Cannot connect to mongo. Exiting.')
  process.exit(1)
}

app.listen(port, host, err => {
  if (err) {
    logger.fatal({ err }, `Cannot bind to ${host}:${port}. Exiting.`)
    process.exit(1)
  }
  logger.debug(`contacts starting up, listening on ${host}:${port}`)
})
