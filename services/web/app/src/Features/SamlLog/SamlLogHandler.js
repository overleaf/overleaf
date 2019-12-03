const { SamlLog } = require('../../models/SamlLog')
const logger = require('logger-sharelatex')

function log(providerId, sessionId, data) {
  const samlLog = new SamlLog()
  samlLog.providerId = (providerId || '').toString()
  samlLog.sessionId = sessionId
  try {
    samlLog.jsonData = JSON.stringify(data)
  } catch (err) {
    logger.error({ err, sessionId, providerId }, 'SamlLog JSON.stringify Error')
  }
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
