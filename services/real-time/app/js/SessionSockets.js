const metrics = require('@overleaf/metrics')
const OError = require('@overleaf/o-error')
const { EventEmitter } = require('node:events')
const { MissingSessionError } = require('./Errors')

module.exports = function (io, sessionStore, cookieParser, cookieName) {
  const missingSessionError = new MissingSessionError()

  const sessionSockets = new EventEmitter()
  function next(error, socket, session) {
    sessionSockets.emit('connection', error, socket, session)
  }

  io.on('connection', function (socket) {
    const req = socket.handshake
    cookieParser(req, {}, function () {
      const sessionId = req.signedCookies && req.signedCookies[cookieName]
      if (!sessionId) {
        metrics.inc('session.cookie', 1, {
          // the cookie-parser middleware sets the signed cookie to false if the
          // signature is invalid, so we can use this to detect bad signatures
          status: sessionId === false ? 'bad-signature' : 'none',
        })
        return next(missingSessionError, socket)
      }
      sessionStore.get(sessionId, function (error, session) {
        if (error) {
          metrics.inc('session.cookie', 1, { status: 'error' })
          OError.tag(error, 'error getting session from sessionStore', {
            sessionId,
          })
          return next(error, socket)
        }
        if (!session) {
          metrics.inc('session.cookie', 1, { status: 'missing' })
          return next(missingSessionError, socket)
        }
        metrics.inc('session.cookie', 1, { status: 'signed' })
        next(null, socket, session)
      })
    })
  })

  return sessionSockets
}
