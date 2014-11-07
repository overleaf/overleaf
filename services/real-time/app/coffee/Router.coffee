Metrics = require "metrics-sharelatex"
logger = require "logger-sharelatex"

module.exports = Router =
	configure: (app, io, session) ->
		session.on 'connection', (error, client, session) ->
			if error?
				logger.err err: error, "error when client connected"
				client?.disconnect()
				return
			
			Metrics.inc('socket-io.connection')
			
			logger.log session: session, "got session"
			
			user = session.user
			if !user?
				logger.log "terminating session without authenticated user"
				client.disconnect()
				return