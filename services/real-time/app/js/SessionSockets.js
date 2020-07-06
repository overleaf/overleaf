// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { EventEmitter } = require('events')

module.exports = function (io, sessionStore, cookieParser, cookieName) {
  const missingSessionError = new Error('could not look up session by key')

  const sessionSockets = new EventEmitter()
  const next = (error, socket, session) =>
    sessionSockets.emit('connection', error, socket, session)

  io.on('connection', function (socket) {
    const req = socket.handshake
    return cookieParser(req, {}, function () {
      const sessionId = req.signedCookies && req.signedCookies[cookieName]
      if (!sessionId) {
        return next(missingSessionError, socket)
      }
      return sessionStore.get(sessionId, function (error, session) {
        if (error) {
          return next(error, socket)
        }
        if (!session) {
          return next(missingSessionError, socket)
        }
        return next(null, socket, session)
      })
    })
  })

  return sessionSockets
}
