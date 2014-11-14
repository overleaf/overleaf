logger = require "logger-sharelatex"
WebApiManager = require "./WebApiManager"
AuthorizationManager = require "./AuthorizationManager"
DocumentUpdaterManager = require "./DocumentUpdaterManager"
ConnectedUsersManager = require "./ConnectedUsersManager"
WebsocketLoadBalancer = require "./WebsocketLoadBalancer"
Utils = require "./Utils"

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
				
			client.join project_id

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
			
			# No need to block for setting the user as connected in the cursor tracking
			ConnectedUsersManager.updateUserPosition project_id, client.id, user, null, () ->
			
	joinDoc: (client, doc_id, fromVersion = -1, callback = (error, doclines, version, ops) ->) ->
		Utils.getClientAttributes client, ["project_id", "user_id"], (error, {project_id, user_id}) ->
			logger.log {user_id, project_id, doc_id, fromVersion, client_id: client.id}, "client joining doc"
					
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
		Utils.getClientAttributes client, ["project_id", "user_id"], (error, {project_id, user_id}) ->
			logger.log {user_id, project_id, doc_id, client_id: client.id}, "client leaving doc"
		client.leave doc_id
		callback()
		
	updateClientPosition: (client, cursorData, callback = (error) ->) ->
		Utils.getClientAttributes client, [
			"project_id", "first_name", "last_name", "email", "user_id"
		], (error, {project_id, first_name, last_name, email, user_id}) ->
			return callback(error) if error?
			logger.log {user_id, project_id, client_id: client.id, cursorData: cursorData}, "updating client position"
			cursorData.id      = client.id
			cursorData.user_id = user_id if user_id?
			cursorData.email   = email   if email?
			if first_name? and last_name?
				cursorData.name = first_name + " " + last_name
				ConnectedUsersManager.updateUserPosition(project_id, client.id, {
					first_name: first_name,
					last_name:  last_name,
					email:      email,
					user_id:    user_id
				}, {
					row:    cursorData.row,
					column: cursorData.column,
					doc_id: cursorData.doc_id
				}, callback)
			else
				cursorData.name = "Anonymous"
				callback()
			WebsocketLoadBalancer.emitToRoom(project_id, "clientTracking.clientUpdated", cursorData)
		
	getConnectedUsers: (client, callback = (error, users) ->) ->
		Utils.getClientAttributes client, ["project_id", "user_id"], (error, {project_id, user_id}) ->
			logger.log {user_id, project_id, client_id: client.id}, "getting connected users"
			
		AuthorizationManager.assertClientCanViewProject client, (error) ->
			return callback(error) if error?
			client.get "project_id", (error, project_id) ->
				return callback(error) if error?
				return callback(new Error("no project_id found on client")) if !project_id?
				ConnectedUsersManager.getConnectedUsers project_id, (error, users) ->
					return callback(error) if error?
					callback null, users

	applyOtUpdate: (client, doc_id, update, callback = (error) ->) ->
		AuthorizationManager.assertClientCanEditProject client, (error) ->
			if error?
				logger.error {err: error, doc_id, client_id: client.id, version: update.v}, "client is not authorized to make update"
				setTimeout () ->
					# Disconnect, but give the client the chance to receive the error
					client.disconnect()
				, 100
				return callback(error)
			
			Utils.getClientAttributes client, ["user_id", "project_id"], (error, {user_id, project_id}) ->
				return callback(error) if error?
				update.meta ||= {}
				update.meta.source = client.id
				update.meta.user_id = user_id
				# metrics.inc "editor.doc-update", 0.3
				# metrics.set "editor.active-projects", project_id, 0.3
				# metrics.set "editor.active-users", user_id, 0.3

				logger.log {user_id, doc_id, project_id, client_id: client.id, version: update.v}, "sending update to doc updater"

				DocumentUpdaterManager.queueChange project_id, doc_id, update, (error) ->
					if error?
						logger.error {err: error, project_id, doc_id, client_id: client.id, version: update.v}, "document was not available for update"
						client.disconnect()
					callback(error)
