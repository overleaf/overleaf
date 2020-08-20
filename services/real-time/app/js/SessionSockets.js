const OError = require('@overleaf/o-error')
const { EventEmitter } = require('events')

module.exports = function (io, sessionStore, cookieParser, cookieName) {
  const missingSessionError = new Error('could not look up session by key')

  const sessionSockets = new EventEmitter()
  function next(error, socket, session) {
    sessionSockets.emit('connection', error, socket, session)
  }

  io.on('connection', function (socket) {
    const req = socket.handshake
    cookieParser(req, {}, function () {
      const sessionId = req.signedCookies && req.signedCookies[cookieName]
      if (!sessionId) {
        return next(missingSessionError, socket)
      }
      sessionStore.get(sessionId, function (error, session) {
        if (error) {
          OError.tag(error, 'error getting session from sessionStore', {
            sessionId
          })
          return next(error, socket)
        }
        if (!session) {
          return next(missingSessionError, socket)
        }
        next(null, socket, session)
      })
    })
  })

  return sessionSockets
}
