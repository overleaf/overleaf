metrics = require "metrics-sharelatex"
logger = require "logger-sharelatex"
settings = require "settings-sharelatex"
WebsocketController = require "./WebsocketController"
HttpController = require "./HttpController"
HttpApiController = require "./HttpApiController"
bodyParser = require "body-parser"
base64id = require("base64id")

basicAuth = require('basic-auth-connect')
httpAuth = basicAuth (user, pass)->
	isValid = user == settings.internal.realTime.user and pass == settings.internal.realTime.pass
	if !isValid
		logger.err user:user, pass:pass, "invalid login details"
	return isValid

module.exports = Router =
	_handleError: (callback = ((error) ->), error, client, method, attrs = {}) ->
			for key in ["project_id", "doc_id", "user_id"]
				attrs[key] = client.ol_context[key]
			attrs.client_id = client.id
			attrs.err = error
			if error.name == "CodedError"
				logger.warn attrs, error.message, code: error.code
				return callback {message: error.message, code: error.code}
			if error.message == 'unexpected arguments'
				# the payload might be very large, put it on level info
				logger.log attrs, 'unexpected arguments'
				metrics.inc 'unexpected-arguments', 1, { status: method }
				return callback { message: error.message }
			if error.message in ["not authorized", "doc updater could not load requested ops", "no project_id found on client"]
				logger.warn attrs, error.message
				return callback {message: error.message}
			else
				logger.error attrs, "server side error in #{method}"
				# Don't return raw error to prevent leaking server side info
				return callback {message: "Something went wrong in real-time service"}

	_handleInvalidArguments: (client, method, args) ->
		error = new Error("unexpected arguments")
		callback = args[args.length - 1]
		if typeof callback != 'function'
			callback = (() ->)
		attrs = {arguments: args}
		Router._handleError(callback, error, client, method, attrs)

	configure: (app, io, session) ->
		app.set("io", io)
		app.get "/clients", HttpController.getConnectedClients
		app.get "/clients/:client_id", HttpController.getConnectedClient

		app.post "/project/:project_id/message/:message", httpAuth, bodyParser.json(limit: "5mb"), HttpApiController.sendMessage
		
		app.post "/drain", httpAuth, HttpApiController.startDrain
		app.post "/client/:client_id/disconnect", httpAuth, HttpApiController.disconnectClient

		session.on 'connection', (error, client, session) ->
			client.ol_context = {} unless client.ol_context

			client?.on "error", (err) ->
				logger.err { clientErr: err }, "socket.io client error"
				if client.connected
					client.emit("reconnectGracefully")
					client.disconnect()

			if settings.shutDownInProgress
				client.emit("connectionRejected", {message: "retry"})
				client.disconnect()
				return

			if client? and error?.message?.match(/could not look up session by key/)
				logger.warn err: error, client: client?, session: session?, "invalid session"
				# tell the client to reauthenticate if it has an invalid session key
				client.emit("connectionRejected", {message: "invalid session"})
				client.disconnect()
				return

			if error?
				logger.err err: error, client: client?, session: session?, "error when client connected"
				client?.emit("connectionRejected", {message: "error"})
				client?.disconnect()
				return

			# send positive confirmation that the client has a valid connection
			client.publicId = 'P.' + base64id.generateId()
			client.emit("connectionAccepted", null, client.publicId)

			metrics.inc('socket-io.connection')
			metrics.gauge('socket-io.clients', io.sockets.clients()?.length)

			logger.log session: session, client_id: client.id, "client connected"

			if session?.passport?.user?
				user = session.passport.user
			else if session?.user?
				user = session.user
			else
				user = {_id: "anonymous-user"}

			client.on "joinProject", (data = {}, callback) ->
				if typeof callback != 'function'
					return Router._handleInvalidArguments(client, 'joinProject', arguments)

				if data.anonymousAccessToken
					user.anonymousAccessToken = data.anonymousAccessToken
				WebsocketController.joinProject client, user, data.project_id, (err, args...) ->
					if err?
						Router._handleError callback, err, client, "joinProject", {project_id: data.project_id, user_id: user?.id}
					else
						callback(null, args...)

			client.on "disconnect", () ->
				metrics.inc('socket-io.disconnect')
				metrics.gauge('socket-io.clients', io.sockets.clients()?.length - 1)

				WebsocketController.leaveProject io, client, (err) ->
					if err?
						Router._handleError (() ->), err, client, "leaveProject"

			# Variadic. The possible arguments:
			# doc_id, callback
			# doc_id, fromVersion, callback
			# doc_id, options, callback
			# doc_id, fromVersion, options, callback
			client.on "joinDoc", (doc_id, fromVersion, options, callback) ->
				if typeof fromVersion == "function" and !options
					callback = fromVersion
					fromVersion = -1
					options = {}
				else if typeof fromVersion == "number" and typeof options == "function"
					callback = options
					options = {}
				else if typeof fromVersion == "object" and typeof options == "function"
					callback = options
					options = fromVersion
					fromVersion = -1
				else if typeof fromVersion == "number" and typeof options == "object" and typeof callback == 'function'
					# Called with 4 args, things are as expected
				else
					return Router._handleInvalidArguments(client, 'joinDoc', arguments)

				WebsocketController.joinDoc client, doc_id, fromVersion, options, (err, args...) ->
					if err?
						Router._handleError callback, err, client, "joinDoc", {doc_id, fromVersion}
					else
						callback(null, args...)

			client.on "leaveDoc", (doc_id, callback) ->
				if typeof callback != 'function'
					return Router._handleInvalidArguments(client, 'leaveDoc', arguments)

				WebsocketController.leaveDoc client, doc_id, (err, args...) ->
					if err?
						Router._handleError callback, err, client, "leaveDoc"
					else
						callback(null, args...)

			client.on "clientTracking.getConnectedUsers", (callback = (error, users) ->) ->
				if typeof callback != 'function'
					return Router._handleInvalidArguments(client, 'clientTracking.getConnectedUsers', arguments)

				WebsocketController.getConnectedUsers client, (err, users) ->
					if err?
						Router._handleError callback, err, client, "clientTracking.getConnectedUsers"
					else
						callback(null, users)

			client.on "clientTracking.updatePosition", (cursorData, callback = (error) ->) ->
				if typeof callback != 'function'
					return Router._handleInvalidArguments(client, 'clientTracking.updatePosition', arguments)

				WebsocketController.updateClientPosition client, cursorData, (err) ->
					if err?
						Router._handleError callback, err, client, "clientTracking.updatePosition"
					else
						callback()

			client.on "applyOtUpdate", (doc_id, update, callback = (error) ->) ->
				if typeof callback != 'function'
					return Router._handleInvalidArguments(client, 'applyOtUpdate', arguments)

				WebsocketController.applyOtUpdate client, doc_id, update, (err) ->
					if err?
						Router._handleError callback, err, client, "applyOtUpdate", {doc_id, update}
					else
						callback()
