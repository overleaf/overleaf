UserCreator = require('../User/UserCreator')
Project = require("../../models/Project").Project
ProjectEntityHandler = require("../Project/ProjectEntityHandler")
mimelib = require("mimelib")
logger = require('logger-sharelatex')
UserGetter = require "../User/UserGetter"
ContactManager = require "../Contacts/ContactManager"
CollaboratorsEmailHandler = require "./CollaboratorsEmailHandler"
async = require "async"

module.exports = CollaboratorsHandler =
	getMemberIdsWithPrivilegeLevels: (project_id, callback = (error, members) ->) ->
		Project.findOne { _id: project_id }, { owner_ref: 1, collaberator_refs: 1, readOnly_refs: 1 }, (error, project) ->
			return callback(error) if error?
			return callback null, null if !project?
			members = []
			members.push { id: project.owner_ref.toString(), privilegeLevel: "admin" }
			for member_id in project.readOnly_refs or []
				members.push { id: member_id, privilegeLevel: "readOnly" }
			for member_id in project.collaberator_refs or []
				members.push { id: member_id, privilegeLevel: "readAndWrite" }
			return callback null, members
	
	getMembersWithPrivilegeLevels: (project_id, callback = (error, members) ->) ->
		CollaboratorsHandler.getMemberIdsWithPrivilegeLevels project_id, (error, members) ->
			return callback(error) if error?
			async.mapLimit (members or []), 3,
				(member, cb) ->
					UserGetter.getUser member.id, (error, user) ->
						return cb(error) if error?
						return cb(null, { user: user, privilegeLevel: member.privilegeLevel })
				callback 
	
	getMemberCount: (project_id, callback = (error, count) ->) ->
		CollaboratorsHandler.getMemberIdsWithPrivilegeLevels project_id, (error, members) ->
			return callback(error) if error?
			return callback null, (members or []).length
		
	getCollaboratorCount: (project_id, callback = (error, count) ->) ->
		CollaboratorsHandler.getMemberCount project_id, (error, count) ->
			return callback(error) if error?
			return callback null, count - 1 # Don't count project owner

	isUserMemberOfProject: (user_id, project_id, callback = (error, isMember, privilegeLevel) ->) ->
		CollaboratorsHandler.getMemberIdsWithPrivilegeLevels project_id, (error, members) ->
			return callback(error) if error?
			for member in members or []
				if member.id.toString() == user_id.toString()
					return callback null, true, member.privilegeLevel
			return callback null, false, null
			
	getProjectsUserIsMemberOf: (user_id, fields, callback = (error, readAndWriteProjects, readOnlyProjects) ->) ->
		Project.find {collaberator_refs:user_id}, fields, (err, readAndWriteProjects)=>
			Project.find {readOnly_refs:user_id}, fields, (err, readOnlyProjects)=>
				callback(err, readAndWriteProjects, readOnlyProjects)
		
	removeUserFromProject: (project_id, user_id, callback = (error) ->)->
		logger.log user_id: user_id, project_id: project_id, "removing user"
		conditions = _id:project_id
		update = $pull:{}
		update["$pull"] = collaberator_refs:user_id, readOnly_refs:user_id
		Project.update conditions, update, (err)->
			if err?
				logger.error err: err, "problem removing user from project collaberators"
			callback(err)
	
	addEmailToProject: (project_id, adding_user_id, unparsed_email, privilegeLevel, callback = (error, user) ->) ->
		emails = mimelib.parseAddresses(unparsed_email)
		email = emails[0]?.address?.toLowerCase()
		if !email? or email == ""
			return callback(new Error("no valid email provided: '#{unparsed_email}'"))
		UserCreator.getUserOrCreateHoldingAccount email, (error, user) ->
			return callback(error) if error?
			CollaboratorsHandler.addUserIdToProject project_id, adding_user_id, user._id, privilegeLevel, (error) ->
				return callback(error) if error?
				return callback null, user._id

	addUserIdToProject: (project_id, adding_user_id, user_id, privilegeLevel, callback = (error) ->)->
		Project.findOne { _id: project_id }, { collaberator_refs: 1, readOnly_refs: 1 }, (error, project) ->
			return callback(error) if error?
			existing_users = (project.collaberator_refs or [])
			existing_users = existing_users.concat(project.readOnly_refs or [])
			existing_users = existing_users.map (u) -> u.toString()
			if existing_users.indexOf(user_id.toString()) > -1
				return callback null # User already in Project
				
			if privilegeLevel == 'readAndWrite'
				level = {"collaberator_refs":user_id}
				logger.log {privileges: "readAndWrite", user_id, project_id}, "adding user"
			else if privilegeLevel == 'readOnly'
				level = {"readOnly_refs":user_id}
				logger.log {privileges: "readOnly", user_id, project_id}, "adding user"
			else
				return callback(new Error("unknown privilegeLevel: #{privilegeLevel}"))

			# Do these in the background
			UserGetter.getUser user_id, {email: 1}, (error, user) ->
				if error?
					logger.error {err: error, project_id, user_id}, "error getting user while adding to project"
				CollaboratorsEmailHandler.notifyUserOfProjectShare project_id, user.email
			ContactManager.addContact adding_user_id, user_id

			Project.update { _id: project_id }, { $addToSet: level }, (error) ->
				return callback(error) if error?
				# Flush to TPDS in background to add files to collaborator's Dropbox
				ProjectEntityHandler.flushProjectToThirdPartyDataStore project_id, (error) ->
					if error?
						logger.error {err: error, project_id, user_id}, "error flushing to TPDS after adding collaborator"
				callback()
