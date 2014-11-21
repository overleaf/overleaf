metrics = require "metrics-sharelatex"
logger = require "logger-sharelatex"
WebsocketController = require "./WebsocketController"
HttpController = require "./HttpController"
Utils = require "./Utils"

module.exports = Router =
	_handleError: (callback = ((error) ->), error, client, method, extraAttrs = {}) ->
		Utils.getClientAttributes client, ["project_id", "doc_id", "user_id"], (_, attrs) ->
			for key, value of extraAttrs
				attrs[key] = value
			attrs.client_id = client.id
			attrs.err = error
			logger.error attrs, "server side error in #{method}"
		# Don't return raw error to prevent leaking server side info
		return callback {message: "Something went wrong"}

	configure: (app, io, session) ->
		app.set("io", io)
		app.get "/clients", HttpController.getConnectedClients
		app.get "/clients/:client_id", HttpController.getConnectedClient
		
		session.on 'connection', (error, client, session) ->
			if error?
				logger.err err: error, "error when client connected"
				client?.disconnect()
				return
			
			metrics.inc('socket-io.connection')
			
			logger.log session: session, client_id: client.id, "client connected"
			
			if !session or !session.user?
				user = {_id: "anonymous-user"}
			else
				user = session.user
				
			client.on "joinProject", (data = {}, callback) ->
				WebsocketController.joinProject client, user, data.project_id, (err, args...) ->
					if err?
						Router._handleError callback, err, client, "joinProject", {project_id: data.project_id, user_id: user?.id}
					else
						callback(null, args...)
						
			client.on "disconnect", () ->
				metrics.inc('socket-io.disconnect')
				WebsocketController.leaveProject io, client, (err) ->
					if err?
						Router._handleError null, err, client, "leaveProject"
						
				
			client.on "joinDoc", (doc_id, fromVersion, callback) ->
				# fromVersion is optional
				if typeof fromVersion == "function"
					callback = fromVersion
					fromVersion = -1
				
				WebsocketController.joinDoc client, doc_id, fromVersion, (err, args...) ->
					if err?
						Router._handleError callback, err, client, "joinDoc", {doc_id, fromVersion}
					else
						callback(null, args...)
						
			client.on "leaveDoc", (doc_id, callback) ->
				WebsocketController.leaveDoc client, doc_id, (err, args...) ->
					if err?
						Router._handleError callback, err, client, "leaveDoc"
					else
						callback(null, args...)
						
			client.on "clientTracking.getConnectedUsers", (callback = (error, users) ->) ->
				WebsocketController.getConnectedUsers client, (err, users) ->
					if err?
						Router._handleError callback, err, client, "clientTracking.getConnectedUsers"
					else
						callback(null, users)
						
			client.on "clientTracking.updatePosition", (cursorData, callback = (error) ->) ->
				WebsocketController.updateClientPosition client, cursorData, (err) ->
					if err?
						Router._handleError callback, err, client, "clientTracking.updatePosition"
					else
						callback()
						
			client.on "applyOtUpdate", (doc_id, update, callback = (error) ->) ->
				WebsocketController.applyOtUpdate client, doc_id, update, (err) ->
					if err?
						Router._handleError callback, err, client, "applyOtUpdate", {doc_id, update}
					else
						callback()