const Metrics = require('metrics-sharelatex')
const logger = require('logger-sharelatex')

function computeValidationToken(req) {
  // this should be a deterministic function of the client-side sessionID,
  // prepended with a version number in case we want to change it later
  return 'v1:' + req.sessionID.slice(-4)
}

function checkValidationToken(req) {
  if (req.session) {
    const sessionToken = req.session.validationToken
    if (sessionToken) {
      const clientToken = computeValidationToken(req)
      // Reject invalid sessions. If you change the method for computing the
      // token (above) then you need to either check or ignore previous
      // versions of the token.
      if (sessionToken === clientToken) {
        Metrics.inc('security.session', 1, { status: 'ok' })
        return true
      } else {
        logger.error(
          {
            sessionToken: sessionToken,
            clientToken: clientToken
          },
          'session token validation failed'
        )
        Metrics.inc('security.session', 1, { status: 'error' })
        return false
      }
    } else {
      Metrics.inc('security.session', 1, { status: 'missing' })
    }
  }
  return true // fallback to allowing session
}

module.exports = {
  enableValidationToken(sessionStore) {
    // generate an identifier from the sessionID for every new session
    const originalGenerate = sessionStore.generate
    sessionStore.generate = function(req) {
      originalGenerate(req)
      // add the validation token as a property that cannot be overwritten
      Object.defineProperty(req.session, 'validationToken', {
        value: computeValidationToken(req),
        enumerable: true,
        writable: false
      })
      Metrics.inc('security.session', 1, { status: 'new' })
    }
  },

  validationMiddleware(req, res, next) {
    if (!req.session.noSessionCallback) {
      if (!checkValidationToken(req)) {
        // the session must exist for it to fail validation
        return req.session.destroy(() => {
          return next(new Error('invalid session'))
        })
      }
    }
    next()
  },

  hasValidationToken(req) {
    if (req && req.session && req.session.validationToken) {
      return true
    } else {
      return false
    }
  }
}
