UserCreator = require('../User/UserCreator')
Project = require("../../models/Project").Project
ProjectEntityHandler = require("../Project/ProjectEntityHandler")
mimelib = require("mimelib")
logger = require('logger-sharelatex')

module.exports = CollaboratorsHandler =
	removeUserFromProject: (project_id, user_id, callback = (error) ->)->
		logger.log user_id: user_id, project_id: project_id, "removing user"
		conditions = _id:project_id
		update = $pull:{}
		update["$pull"] = collaberator_refs:user_id, readOnly_refs:user_id
		Project.update conditions, update, (err)->
			if err?
				logger.error err: err, "problem removing user from project collaberators"
			callback(err)
	
	addEmailToProject: (project_id, unparsed_email, privilegeLevel, callback = (error, user) ->) ->
		emails = mimelib.parseAddresses(unparsed_email)
		email = emails[0]?.address?.toLowerCase()
		if !email? or email == ""
			return callback(new Error("no valid email provided: '#{unparsed_email}'"))
		UserCreator.getUserOrCreateHoldingAccount email, (error, user) ->
			return callback(error) if error?
			CollaboratorsHandler.addUserToProject project_id, user._id, privilegeLevel, (error) ->
				return callback(error) if error?
				return callback null, user._id

	addUserToProject: (project_id, user_id, privilegeLevel, callback = (error) ->)->
		if privilegeLevel == 'readAndWrite'
			level = {"collaberator_refs":user_id}
			logger.log {privileges: "readAndWrite", user_id, project_id}, "adding user"
		else if privilegeLevel == 'readOnly'
			level = {"readOnly_refs":user_id}
			logger.log {privileges: "readOnly", user_id, project_id}, "adding user"
		else
			return callback(new Error("unknown privilegeLevel: #{privilegeLevel}"))
		Project.update { _id: project_id }, { $push:level }, (error) ->
			return callback(error) if error?
			# Flush to TPDS in background to add files to collaborator's Dropbox
			ProjectEntityHandler.flushProjectToThirdPartyDataStore project_id, (error) ->
				if error?
					logger.error {err: error, project_id, user_id}, "error flushing to TPDS after adding collaborator"
			callback()
