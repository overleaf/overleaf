logger = require "logger-sharelatex"
WebApiManager = require "./WebApiManager"
AuthorizationManager = require "./AuthorizationManager"
DocumentUpdaterManager = require "./DocumentUpdaterManager"

module.exports = WebsocketController =
	# If the protocol version changes when the client reconnects,
	# it will force a full refresh of the page. Useful for non-backwards
	# compatible protocol changes. Use only in extreme need.
	PROTOCOL_VERSION: 2
	
	joinProject: (client, user, project_id, callback = (error, project, privilegeLevel, protocolVersion) ->) ->
		user_id = user?._id
		logger.log {user_id, project_id, client_id: client.id}, "user joining project"
		WebApiManager.joinProject project_id, user_id, (error, project, privilegeLevel) ->
			return callback(error) if error?

			if !privilegeLevel or privilegeLevel == ""
				err = new Error("not authorized")
				logger.error {err, project_id, user_id, client_id: client.id}, "user is not authorized to join project"
				return callback(err)

			client.set("privilege_level", privilegeLevel)
			client.set("user_id", user_id)
			client.set("project_id", project_id)
			client.set("owner_id", project?.owner?._id)
			client.set("first_name", user?.first_name)
			client.set("last_name", user?.last_name)
			client.set("email", user?.email)
			client.set("connected_time", new Date())
			client.set("signup_date", user?.signUpDate)
			client.set("login_count", user?.loginCount)
			
			callback null, project, privilegeLevel, WebsocketController.PROTOCOL_VERSION
			
	joinDoc: (client, doc_id, fromVersion = -1, callback = (error, doclines, version, ops) ->) ->
		WebsocketController._getClientData client, (error, {client_id, user_id, project_id}) ->
			logger.log {user_id, project_id, doc_id, fromVersion, client_id}, "client joining doc"
					
		AuthorizationManager.assertClientCanViewProject client, (error) ->
			return callback(error) if error?
			client.get "project_id", (error, project_id) ->
				return callback(error) if error?
				return callback(new Error("no project_id found on client")) if !project_id?
				DocumentUpdaterManager.getDocument project_id, doc_id, fromVersion, (error, lines, version, ops) ->
					return callback(error) if error?
					# Encode any binary bits of data so it can go via WebSockets
					# See http://ecmanaut.blogspot.co.uk/2006/07/encoding-decoding-utf8-in-javascript.html
					escapedLines = []
					for line in lines
						try
							line = unescape(encodeURIComponent(line))
						catch err
							logger.err {err, project_id, doc_id, fromVersion, line, client_id: client.id}, "error encoding line uri component"
							return callback(err)
						escapedLines.push line
					client.join(doc_id)
					callback null, escapedLines, version, ops
					
	leaveDoc: (client, doc_id, callback = (error) ->) ->
		WebsocketController._getClientData client, (error, {client_id, user_id, project_id}) ->
			logger.log {user_id, project_id, doc_id, client_id}, "client leaving doc"
		client.leave doc_id
		callback()
		
	# Only used in logging.
	_getClientData: (client, callback = (error, data) ->) ->
		client.get "user_id", (error, user_id) ->
			client.get "project_id", (error, project_id) ->
				callback null, {client_id: client.id, project_id, user_id}
			