CollaboratorsHandler = require("../Collaborators/CollaboratorsHandler")
Project = require("../../models/Project").Project
User = require("../../models/User").User

module.exports = AuthorizationManager =
	# Get the privilege level that the user has for the project
	# Returns:
	#	* privilegeLevel: "owner", "readAndWrite", of "readOnly" if the user has
	#	  access. false if the user does not have access
	#   * becausePublic: true if the access level is only because the project is public.
	getPrivilegeLevelForProject: (user_id, project_id, callback = (error, privilegeLevel, becausePublic) ->) ->
		getPublicAccessLevel = () ->
			Project.findOne { _id: project_id }, { publicAccesLevel: 1 }, (error, project) ->
				return callback(error) if error?
				if project.publicAccesLevel in ["readOnly", "readAndWrite"]
					return callback null, project.publicAccesLevel, true
				else
					return callback null, false, false
		
		if !user_id?
			getPublicAccessLevel()
		else
			CollaboratorsHandler.getMemberIdPrivilegeLevel user_id, project_id, (error, privilegeLevel) ->
				return callback(error) if error?
				if privilegeLevel? and privilegeLevel
					# The user has direct access
					callback null, privilegeLevel, false
				else
					getPublicAccessLevel()

	canUserReadProject: (user_id, project_id, callback = (error, canRead) ->) ->
		AuthorizationManager.getPrivilegeLevelForProject user_id, project_id, (error, privilegeLevel) ->
			return callback(error) if error?
			return callback null, (privilegeLevel in ["owner", "readAndWrite", "readOnly"])
		
	canUserWriteProjectContent: (user_id, project_id, callback = (error, canWriteContent) ->) ->
		AuthorizationManager.getPrivilegeLevelForProject user_id, project_id, (error, privilegeLevel) ->
			return callback(error) if error?
			return callback null, (privilegeLevel in ["owner", "readAndWrite"])
		
	canUserWriteProjectSettings: (user_id, project_id, callback = (error, canWriteSettings) ->) ->
		AuthorizationManager.getPrivilegeLevelForProject user_id, project_id, (error, privilegeLevel, becausePublic) ->
			return callback(error) if error?
			if privilegeLevel == "owner"
				return callback null, true
			else if privilegeLevel == "readAndWrite" and !becausePublic
				return callback null, true
			else
				return callback null, false
	
	canUserAdminProject: (user_id, project_id, callback = (error, canAdmin) ->) ->
		AuthorizationManager.getPrivilegeLevelForProject user_id, project_id, (error, privilegeLevel) ->
			return callback(error) if error?
			return callback null, (privilegeLevel == "owner")
	
	isUserSiteAdmin: (user_id, callback = (error, isAdmin) ->) ->
		if !user_id?
			return callback null, false
		User.findOne { _id: user_id }, { isAdmin: 1 }, (error, user) ->
			return callback(error) if error?
			return callback null, (user?.isAdmin == true)