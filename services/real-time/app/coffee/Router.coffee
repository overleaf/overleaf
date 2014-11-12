Metrics = require "metrics-sharelatex"
logger = require "logger-sharelatex"
WebsocketController = require "./WebsocketController"

module.exports = Router =
	# We don't want to send raw errors back to the client, in case they
	# contain sensitive data. Instead we log them out, and send a generic
	# JSON object which can be serialized over socket.io
	_createCallbackWithErrorFilter: (client, method, callback) ->
		return (err, args...) ->
			if err?
				
				err = {message: "Something went wrong"}
			callback err, args...
			
	# Used in error reporting
	_getClientData: (client, callback = (error, data) ->) ->
		client.get "user_id", (error, user_id) ->
			client.get "project_id", (error, project_id) ->
				client.get "doc_id", (error, doc_id) ->
					callback null, { id: client.id, user_id, project_id, doc_id }

	configure: (app, io, session) ->
		session.on 'connection', (error, client, session) ->
			if error?
				logger.err err: error, "error when client connected"
				client?.disconnect()
				return
			
			Metrics.inc('socket-io.connection')
			
			logger.log session: session, client_id: client.id, "client connected"
			
			user = session.user
			if !user? or !user._id?
				logger.log "terminating session without authenticated user"
				client.disconnect()
				return
				
			client.on "joinProject", (data = {}, callback) ->
				WebsocketController.joinProject client, user, data.project_id, (err, args...) ->
					if err?
						Router._getClientData client, (_, client) ->
							logger.error {err, client, project_id: data.project_id}, "server side error in joinProject"
						# Don't return raw error to prevent leaking server side info
						return callback {message: "Something went wrong"}
					else
						callback(null, args...)
						
				
			client.on "joinDoc", (doc_id, fromVersion, callback) ->
				# fromVersion is optional
				if typeof fromVersion == "function"
					callback = fromVersion
					fromVersion = -1
				
				WebsocketController.joinDoc client, doc_id, fromVersion, (err, args...) ->
					if err?
						Router._getClientData client, (_, client) ->
							logger.error {err, client, doc_id, fromVersion}, "server side error in joinDoc"
						# Don't return raw error to prevent leaking server side info
						return callback {message: "Something went wrong"}
					else
						callback(null, args...)
				