const { SamlLog } = require('../../models/SamlLog')
const logger = require('logger-sharelatex')

function log(providerId, sessionId, data) {
  try {
    const samlLog = new SamlLog()
    samlLog.providerId = providerId = (providerId || '').toString()
    samlLog.sessionId = sessionId = (sessionId || '').toString().substr(0, 8)
    try {
      samlLog.jsonData = JSON.stringify(data)
    } catch (err) {
      // log but continue on data errors
      logger.error(
        { err, sessionId, providerId },
        'SamlLog JSON.stringify Error'
      )
    }
    samlLog.save(err => {
      if (err) {
        logger.error({ err, sessionId, providerId }, 'SamlLog Error')
      }
    })
  } catch (err) {
    logger.error({ err, sessionId, providerId }, 'SamlLog Error')
  }
}

const SamlLogHandler = {
  log
}

module.exports = SamlLogHandler
