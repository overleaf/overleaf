logger = require "logger-sharelatex"
metrics = require "metrics-sharelatex"
settings = require "settings-sharelatex"
WebApiManager = require "./WebApiManager"
AuthorizationManager = require "./AuthorizationManager"
DocumentUpdaterManager = require "./DocumentUpdaterManager"
ConnectedUsersManager = require "./ConnectedUsersManager"
WebsocketLoadBalancer = require "./WebsocketLoadBalancer"
RoomManager = require "./RoomManager"

module.exports = WebsocketController =
	# If the protocol version changes when the client reconnects,
	# it will force a full refresh of the page. Useful for non-backwards
	# compatible protocol changes. Use only in extreme need.
	PROTOCOL_VERSION: 2

	joinProject: (client, user, project_id, callback = (error, project, privilegeLevel, protocolVersion) ->) ->
		if client.disconnected
			metrics.inc('editor.join-project.disconnected', 1, {status: 'immediately'})
			return callback()

		user_id = user?._id
		logger.log {user_id, project_id, client_id: client.id}, "user joining project"
		metrics.inc "editor.join-project"
		WebApiManager.joinProject project_id, user, (error, project, privilegeLevel, isRestrictedUser) ->
			return callback(error) if error?
			if client.disconnected
				metrics.inc('editor.join-project.disconnected', 1, {status: 'after-web-api-call'})
				return callback()

			if !privilegeLevel or privilegeLevel == ""
				err = new Error("not authorized")
				logger.warn {err, project_id, user_id, client_id: client.id}, "user is not authorized to join project"
				return callback(err)

			client.ol_context = {}
			client.ol_context["privilege_level"] = privilegeLevel
			client.ol_context["user_id"] = user_id
			client.ol_context["project_id"] = project_id
			client.ol_context["owner_id"] = project?.owner?._id
			client.ol_context["first_name"] = user?.first_name
			client.ol_context["last_name"] = user?.last_name
			client.ol_context["email"] = user?.email
			client.ol_context["connected_time"] = new Date()
			client.ol_context["signup_date"] = user?.signUpDate
			client.ol_context["login_count"] = user?.loginCount
			client.ol_context["is_restricted_user"] = !!(isRestrictedUser)

			RoomManager.joinProject client, project_id, (err) ->
				return callback(err) if err
				logger.log {user_id, project_id, client_id: client.id}, "user joined project"
				callback null, project, privilegeLevel, WebsocketController.PROTOCOL_VERSION

			# No need to block for setting the user as connected in the cursor tracking
			ConnectedUsersManager.updateUserPosition project_id, client.publicId, user, null, () ->

	# We want to flush a project if there are no more (local) connected clients
	# but we need to wait for the triggering client to disconnect. How long we wait
	# is determined by FLUSH_IF_EMPTY_DELAY.
	FLUSH_IF_EMPTY_DELAY: 500 #ms
	leaveProject: (io, client, callback = (error) ->) ->
			{project_id, user_id} = client.ol_context
			return callback() unless project_id # client did not join project

			metrics.inc "editor.leave-project"
			logger.log {project_id, user_id, client_id: client.id}, "client leaving project"
			WebsocketLoadBalancer.emitToRoom project_id, "clientTracking.clientDisconnected", client.publicId

			# We can do this in the background
			ConnectedUsersManager.markUserAsDisconnected project_id, client.publicId, (err) ->
				if err?
					logger.error {err, project_id, user_id, client_id: client.id}, "error marking client as disconnected"

			RoomManager.leaveProjectAndDocs(client)
			setTimeout () ->
				remainingClients = io.sockets.clients(project_id)
				if remainingClients.length == 0
					# Flush project in the background
					DocumentUpdaterManager.flushProjectToMongoAndDelete project_id, (err) ->
						if err?
							logger.error {err, project_id, user_id, client_id: client.id}, "error flushing to doc updater after leaving project"
				callback()
			, WebsocketController.FLUSH_IF_EMPTY_DELAY

	joinDoc: (client, doc_id, fromVersion = -1, options, callback = (error, doclines, version, ops, ranges) ->) ->
			if client.disconnected
				metrics.inc('editor.join-doc.disconnected', 1, {status: 'immediately'})
				return callback()

			metrics.inc "editor.join-doc"
			{project_id, user_id, is_restricted_user} = client.ol_context
			return callback(new Error("no project_id found on client")) if !project_id?
			logger.log {user_id, project_id, doc_id, fromVersion, client_id: client.id}, "client joining doc"

			AuthorizationManager.assertClientCanViewProject client, (error) ->
				return callback(error) if error?
				# ensure the per-doc applied-ops channel is subscribed before sending the
				# doc to the client, so that no events are missed.
				RoomManager.joinDoc client, doc_id, (error) ->
					return callback(error) if error?
					if client.disconnected
						metrics.inc('editor.join-doc.disconnected', 1, {status: 'after-joining-room'})
						# the client will not read the response anyways
						return callback()

					DocumentUpdaterManager.getDocument project_id, doc_id, fromVersion, (error, lines, version, ranges, ops) ->
						return callback(error) if error?
						if client.disconnected
							metrics.inc('editor.join-doc.disconnected', 1, {status: 'after-doc-updater-call'})
							# the client will not read the response anyways
							return callback()

						if is_restricted_user and ranges?.comments?
							ranges.comments = []

						# Encode any binary bits of data so it can go via WebSockets
						# See http://ecmanaut.blogspot.co.uk/2006/07/encoding-decoding-utf8-in-javascript.html
						encodeForWebsockets = (text) -> unescape(encodeURIComponent(text))
						escapedLines = []
						for line in lines
							try
								line = encodeForWebsockets(line)
							catch err
								logger.err {err, project_id, doc_id, fromVersion, line, client_id: client.id}, "error encoding line uri component"
								return callback(err)
							escapedLines.push line
						if options.encodeRanges
							try
								for comment in ranges?.comments or []
									comment.op.c = encodeForWebsockets(comment.op.c) if comment.op.c?
								for change in ranges?.changes or []
									change.op.i = encodeForWebsockets(change.op.i) if change.op.i?
									change.op.d = encodeForWebsockets(change.op.d) if change.op.d?
							catch err
								logger.err {err, project_id, doc_id, fromVersion, ranges, client_id: client.id}, "error encoding range uri component"
								return callback(err)

						AuthorizationManager.addAccessToDoc client, doc_id
						logger.log {user_id, project_id, doc_id, fromVersion, client_id: client.id}, "client joined doc"
						callback null, escapedLines, version, ops, ranges

	leaveDoc: (client, doc_id, callback = (error) ->) ->
			# client may have disconnected, but we have to cleanup internal state.
			metrics.inc "editor.leave-doc"
			{project_id, user_id} = client.ol_context
			logger.log {user_id, project_id, doc_id, client_id: client.id}, "client leaving doc"
			RoomManager.leaveDoc(client, doc_id)
			# we could remove permission when user leaves a doc, but because
			# the connection is per-project, we continue to allow access
			# after the initial joinDoc since we know they are already authorised.
			## AuthorizationManager.removeAccessToDoc client, doc_id
			callback()
	updateClientPosition: (client, cursorData, callback = (error) ->) ->
			if client.disconnected
				# do not create a ghost entry in redis
				return callback()

			metrics.inc "editor.update-client-position", 0.1
			{project_id, first_name, last_name, email, user_id} = client.ol_context
			logger.log {user_id, project_id, client_id: client.id, cursorData: cursorData}, "updating client position"

			AuthorizationManager.assertClientCanViewProjectAndDoc client, cursorData.doc_id, (error) ->
				if error?
					logger.warn {err: error, client_id: client.id, project_id, user_id}, "silently ignoring unauthorized updateClientPosition. Client likely hasn't called joinProject yet."
					return callback()
				cursorData.id      = client.publicId
				cursorData.user_id = user_id if user_id?
				cursorData.email   = email   if email?
				# Don't store anonymous users in redis to avoid influx
				if !user_id or user_id == 'anonymous-user'
					cursorData.name = ""
					callback()
				else
					cursorData.name = if first_name && last_name
						"#{first_name} #{last_name}"
					else if first_name
						first_name
					else if last_name
						last_name
					else
						""
					ConnectedUsersManager.updateUserPosition(project_id, client.publicId, {
						first_name: first_name,
						last_name:  last_name,
						email:      email,
						_id:        user_id
					}, {
						row:    cursorData.row,
						column: cursorData.column,
						doc_id: cursorData.doc_id
					}, callback)
				WebsocketLoadBalancer.emitToRoom(project_id, "clientTracking.clientUpdated", cursorData)

	CLIENT_REFRESH_DELAY: 1000
	getConnectedUsers: (client, callback = (error, users) ->) ->
			if client.disconnected
				# they are not interested anymore, skip the redis lookups
				return callback()

			metrics.inc "editor.get-connected-users"
			{project_id, user_id, is_restricted_user} = client.ol_context
			if is_restricted_user
				return callback(null, [])
			return callback(new Error("no project_id found on client")) if !project_id?
			logger.log {user_id, project_id, client_id: client.id}, "getting connected users"
			AuthorizationManager.assertClientCanViewProject client, (error) ->
				return callback(error) if error?
				WebsocketLoadBalancer.emitToRoom project_id, 'clientTracking.refresh'
				setTimeout () ->
					ConnectedUsersManager.getConnectedUsers project_id, (error, users) ->
						return callback(error) if error?
						callback null, users
						logger.log {user_id, project_id, client_id: client.id}, "got connected users"
				, WebsocketController.CLIENT_REFRESH_DELAY

	applyOtUpdate: (client, doc_id, update, callback = (error) ->) ->
			# client may have disconnected, but we can submit their update to doc-updater anyways.
			{user_id, project_id} = client.ol_context
			return callback(new Error("no project_id found on client")) if !project_id?

			WebsocketController._assertClientCanApplyUpdate client, doc_id, update, (error) ->
				if error?
					logger.warn {err: error, doc_id, client_id: client.id, version: update.v}, "client is not authorized to make update"
					setTimeout () ->
						# Disconnect, but give the client the chance to receive the error
						client.disconnect()
					, 100
					return callback(error)
				update.meta ||= {}
				update.meta.source = client.publicId
				update.meta.user_id = user_id
				metrics.inc "editor.doc-update", 0.3

				logger.log {user_id, doc_id, project_id, client_id: client.id, version: update.v}, "sending update to doc updater"

				DocumentUpdaterManager.queueChange project_id, doc_id, update, (error) ->
					if error?.message == "update is too large"
						metrics.inc "update_too_large"
						updateSize = error.updateSize
						logger.warn({user_id, project_id, doc_id, updateSize}, "update is too large")

						# mark the update as received -- the client should not send it again!
						callback()

						# trigger an out-of-sync error
						message = {project_id, doc_id, error: "update is too large"}
						setTimeout () ->
							if client.disconnected
								# skip the message broadcast, the client has moved on
								return metrics.inc('editor.doc-update.disconnected', 1, {status:'at-otUpdateError'})
							client.emit "otUpdateError", message.error, message
							client.disconnect()
						, 100
						return

					if error?
						logger.error {err: error, project_id, doc_id, client_id: client.id, version: update.v}, "document was not available for update"
						client.disconnect()
					callback(error)

	_assertClientCanApplyUpdate: (client, doc_id, update, callback) ->
		AuthorizationManager.assertClientCanEditProjectAndDoc client, doc_id, (error) ->
			if error?
				if error.message == "not authorized" and WebsocketController._isCommentUpdate(update)
					# This might be a comment op, which we only need read-only priveleges for
					AuthorizationManager.assertClientCanViewProjectAndDoc client, doc_id, callback
				else
					return callback(error)
			else
				return callback(null)

	_isCommentUpdate: (update) ->
		for op in update.op
			if !op.c?
				return false
		return true
