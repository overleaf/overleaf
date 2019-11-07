const { SamlLog } = require('../../models/SamlLog')
const logger = require('logger-sharelatex')

function log(providerId, sessionId, data) {
  const samlLog = new SamlLog()
  samlLog.providerId = (providerId || '').toString()
  samlLog.sessionId = sessionId
  samlLog.data = data
  samlLog.save(err => {
    if (err) {
      logger.error({ err, sessionId, providerId }, 'SamlLog Error')
    }
  })
}

const SamlLogHandler = {
  log
}

module.exports = SamlLogHandler
