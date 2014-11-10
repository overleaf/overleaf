logger = require "logger-sharelatex"
WebApiManager = require "./WebApiManager"

module.exports = WebsocketController =
	# If the protocol version changes when the client reconnects,
	# it will force a full refresh of the page. Useful for non-backwards
	# compatible protocol changes. Use only in extreme need.
	PROTOCOL_VERSION: 2
	
	joinProject: (client, user, project_id, callback = (error, project, privilegeLevel, protocolVersion) ->) ->
		user_id = user?._id
		logger.log {user_id, project_id}, "user joining project"
		WebApiManager.joinProject project_id, user_id, (error, project, privilegeLevel) ->
			return callback(error) if error?

			if !privilegeLevel or privilegeLevel == ""
				err = new Error("not authorized")
				logger.error {err, project_id, user_id}, "user is not authorized to join project"
				return callback(err)

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