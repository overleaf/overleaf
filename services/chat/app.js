import logger from '@overleaf/logger'
import settings from '@overleaf/settings'
import { mongoClient } from './app/js/mongodb.js'
import { server } from './app/js/server.js'

const port = settings.internal.chat.port
const host = settings.internal.chat.host
mongoClient
  .connect()
  .then(() => {
    server.listen(port, host, function (err) {
      if (err) {
        logger.fatal({ err }, `Cannot bind to ${host}:${port}. Exiting.`)
        process.exit(1)
      }
      logger.debug(`Chat starting up, listening on ${host}:${port}`)
    })
  })
  .catch(err => {
    logger.fatal({ err }, 'Cannot connect to mongo. Exiting.')
    process.exit(1)
  })
