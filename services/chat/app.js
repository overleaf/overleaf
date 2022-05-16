const logger = require('@overleaf/logger')
const settings = require('@overleaf/settings')

const mongodb = require('./app/js/mongodb')
const Server = require('./app/js/server')

if (!module.parent) {
  // Called directly
  const port = settings.internal.chat.port
  const host = settings.internal.chat.host
  mongodb
    .waitForDb()
    .then(() => {
      Server.server.listen(port, host, function (err) {
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
}

module.exports = Server.server
