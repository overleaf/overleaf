const { SamlLog } = require('../../models/SamlLog')
const SessionManager = require('../Authentication/SessionManager')
const logger = require('@overleaf/logger')
const { err: errSerializer } = require('@overleaf/logger/serializers')
const { callbackify } = require('util')
const Settings = require('@overleaf/settings')

const ALLOWED_PATHS = Settings.saml?.logAllowList || ['/saml/']

async function log(req, data, samlAssertion) {
  let providerId, sessionId

  data = data || {}

  try {
    const { path, query } = req
    if (!ALLOWED_PATHS.some(allowedPath => path.startsWith(allowedPath))) {
      return
    }

    const { saml } = req.session
    const userId = SessionManager.getLoggedInUserId(req.session)

    providerId = (req.session.saml?.universityId || '').toString()
    sessionId = (req.sessionID || '').toString().substr(0, 8)

    const samlLog = new SamlLog()
    samlLog.providerId = providerId
    samlLog.sessionId = sessionId
    samlLog.path = path
    samlLog.userId = userId
    data.query = query
    data.samlSession = saml

    if (data.error instanceof Error) {
      const errSerialized = errSerializer(data.error)
      if (data.error.tryAgain) {
        errSerialized.tryAgain = data.error.tryAgain
      }
      req.logger.addFields({ providerId, sessionId, userId })
      data.error = errSerialized
    }

    if (samlAssertion) {
      const samlAssertionForLog = {
        assertionXml: samlAssertion.getAssertionXml(),
        responseXml: samlAssertion.getSamlResponseXml(),
        assertionJsonExtended: req.user_info,
      }
      samlLog.samlAssertion = JSON.stringify(samlAssertionForLog)
    }

    if (data.error) {
      data.body = {}
      if (req.body.email) {
        data.body.email = req.body.email
      }
      if (req.body.SAMLResponse) {
        data.body.SAMLResponse = req.body.SAMLResponse
      }
    }

    try {
      samlLog.jsonData = JSON.stringify(data)
    } catch (err) {
      // log but continue on data errors
      logger.error(
        { err, sessionId, providerId },
        'SamlLog JSON.stringify Error'
      )
    }
    await samlLog.save()
  } catch (err) {
    logger.error({ err, sessionId, providerId }, 'SamlLog Error')
  }
}

const SamlLogHandler = {
  log: callbackify(log),
  promises: {
    log,
  },
}

module.exports = SamlLogHandler
