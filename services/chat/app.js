/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const logger = require('logger-sharelatex')
const settings = require('@overleaf/settings')

const mongodb = require('./app/js/mongodb')
const Server = require('./app/js/server')

if (!module.parent) {
  // Called directly
  const port =
    __guard__(
      settings.internal != null ? settings.internal.chat : undefined,
      (x) => x.port
    ) || 3010
  const host =
    __guard__(
      settings.internal != null ? settings.internal.chat : undefined,
      (x1) => x1.host
    ) || 'localhost'
  mongodb
    .waitForDb()
    .then(() => {
      Server.server.listen(port, host, function (err) {
        if (err) {
          logger.fatal({ err }, `Cannot bind to ${host}:${port}. Exiting.`)
          process.exit(1)
        }
        return logger.info(`Chat starting up, listening on ${host}:${port}`)
      })
    })
    .catch((err) => {
      logger.fatal({ err }, 'Cannot connect to mongo. Exiting.')
      process.exit(1)
    })
}

module.exports = Server.server

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
