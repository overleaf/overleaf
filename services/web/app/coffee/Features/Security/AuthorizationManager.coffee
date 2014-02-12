SecurityManager = require '../../managers/SecurityManager'

module.exports = AuthorizationManager =
	getPrivilegeLevelForProject: (
		project, user,
		callback = (error, canAccess, privilegeLevel)->
	) ->
		# This is not tested because eventually this function should be brought into
		# this module.
		SecurityManager.userCanAccessProject user, project, (canAccess, privilegeLevel) ->
			if canAccess
				callback null, true, privilegeLevel
			else
				callback null, false
	
	setPrivilegeLevelOnClient: (client, privilegeLevel) ->
		client.set("privilege_level", privilegeLevel)

	ensureClientCanViewProject: (client, callback = (error, project_id)->) ->
		@ensureClientHasPrivilegeLevelForProject client, ["owner", "readAndWrite", "readOnly"], callback

	ensureClientCanEditProject: (client, callback = (error, project_id)->) ->
		@ensureClientHasPrivilegeLevelForProject client, ["owner", "readAndWrite"], callback

	ensureClientCanAdminProject: (client, callback = (error, project_id)->) ->
		@ensureClientHasPrivilegeLevelForProject client, ["owner"], callback
	
	ensureClientHasPrivilegeLevelForProject: (client, levels, callback = (error, project_id)->) ->
		client.get "privilege_level", (error, level) ->
			return callback(error) if error?
			if level?
				client.get "project_id", (error, project_id) ->
					return callback(error) if error?
					if project_id?
						if levels.indexOf(level) > -1
							callback null, project_id
		

