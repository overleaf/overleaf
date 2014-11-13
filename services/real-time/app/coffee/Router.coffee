Metrics = require "metrics-sharelatex"
logger = require "logger-sharelatex"
WebsocketController = require "./WebsocketController"
HttpController = require "./HttpController"
Utils = require "./Utils"

module.exports = Router =
	configure: (app, io, session) ->
		app.set("io", io)
		app.get "/clients", HttpController.getConnectedClients
		app.get "/clients/:client_id", HttpController.getConnectedClient
		
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
						logger.error {err, user_id: user?.id, project_id: data.project_id}, "server side error in joinProject"
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
						Utils.getClientAttributes client, ["project_id", "user_id"], (_, {project_id, user_id}) ->
							logger.error {err, client_id: client.id, user_id, project_id, doc_id, fromVersion}, "server side error in joinDoc"
						# Don't return raw error to prevent leaking server side info
						return callback {message: "Something went wrong"}
					else
						callback(null, args...)
						
			client.on "leaveDoc", (doc_id, callback) ->
				WebsocketController.leaveDoc client, doc_id, (err, args...) ->
					if err?
						Utils.getClientAttributes client, ["project_id", "user_id"], (_, {project_id, user_id}) ->
							logger.error {err, client_id: client.id, user_id, project_id, doc_id}, "server side error in leaveDoc"
						# Don't return raw error to prevent leaking server side info
						return callback {message: "Something went wrong"}
					else
						callback(null, args...)
						
			client.on "getConnectedUsers", (callback = (error, users) ->) ->
				WebsocketController.getConnectedUsers client, (err, users) ->
					if err?
						Utils.getClientAttributes client, ["project_id", "user_id", "doc_id"], (_, {project_id, user_id, doc_id}) ->
							logger.error {err, client_id: client.id, user_id, project_id, doc_id}, "server side error in getConnectedUsers"
						# Don't return raw error to prevent leaking server side info
						return callback {message: "Something went wrong"}
					else
						callback(null, users)
		