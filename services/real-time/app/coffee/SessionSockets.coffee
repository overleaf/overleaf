{EventEmitter} = require('events')

module.exports = (io, sessionStore, cookieParser, cookieName) ->
	missingSessionError = new Error('could not look up session by key')

	sessionSockets = new EventEmitter()
	next = (error, socket, session) ->
		sessionSockets.emit 'connection', error, socket, session

	io.on 'connection', (socket) ->
		req = socket.handshake
		cookieParser req, {}, () ->
			sessionId = req.signedCookies and req.signedCookies[cookieName]
			if not sessionId
				return next(missingSessionError, socket)
			sessionStore.get sessionId, (error, session) ->
				if error
					return next(error, socket)
				if not session
					return next(missingSessionError, socket)
				next(null, socket, session)

	return sessionSockets
