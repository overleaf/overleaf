import { SamlLog } from '../../models/SamlLog.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import logger from '@overleaf/logger'
import loggerSerializers from '@overleaf/logger/serializers.js'
import { callbackify } from 'node:util'
import Settings from '@overleaf/settings'
import {
  z,
  parseReq,
  getRawReqInput,
} from '../../infrastructure/Validation.mjs'

const ALLOWED_PATHS = Settings.saml?.logAllowList || ['/saml/']

const samlLogBodySchema = z.object({
  body: z.object({
    email: z.string().optional(),
    SAMLResponse: z.string().optional(),
  }),
})

async function log(req, data, samlAssertion) {
  let providerId, sessionId

  data = data || {}

  try {
    const { path } = req
    // audit log stores the full raw query verbatim; not read by field name
    // here (case 1: verbatim forwarding)
    const { query } = getRawReqInput(req)
    if (!ALLOWED_PATHS.some(allowedPath => path.startsWith(allowedPath))) {
      return
    }

    const { saml } = req.session
    const userId = SessionManager.getLoggedInUserId(req.session)

    providerId = (req.session.saml?.providerId || '').toString()
    sessionId = (req.sessionID || '').toString().substr(0, 8)

    const samlLog = new SamlLog()
    samlLog.providerId = providerId
    samlLog.sessionId = sessionId
    samlLog.path = path
    samlLog.userId = userId
    data.query = query
    data.samlSession = saml

    if (data.error instanceof Error) {
      const errSerialized = loggerSerializers.err(data.error)
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
      const { body } = parseReq(req, samlLogBodySchema, { logOnly: true })
      data.body = {}
      if (body.email) {
        data.body.email = body.email
      }
      if (body.SAMLResponse) {
        data.body.SAMLResponse = body.SAMLResponse
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

export default SamlLogHandler
