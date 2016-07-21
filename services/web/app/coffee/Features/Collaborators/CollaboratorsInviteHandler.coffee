UserCreator = require('../User/UserCreator')
Project = require("../../models/Project").Project
mimelib = require("mimelib")
logger = require('logger-sharelatex')
UserGetter = require "../User/UserGetter"
ContactManager = require "../Contacts/ContactManager"
CollaboratorsEmailHandler = require "./CollaboratorsEmailHandler"
Async = require "async"
PrivilegeLevels = require "../Authorization/PrivilegeLevels"
Errors = require "../Errors/Errors"

module.experts = CollaboratorsInviteHandler =

	# helpers
	getMemberIdsWithPrivilegeLevels: (project_id, callback = (error, members) ->) ->
		Project.findOne { _id: project_id }, { owner_ref: 1, collaberator_refs: 1, readOnly_refs: 1 }, (error, project) ->
			return callback(error) if error?
			return callback new Errors.NotFoundError("no project found with id #{project_id}") if !project?
			members = []
			members.push { id: project.owner_ref.toString(), privilegeLevel: PrivilegeLevels.OWNER }
			for member_id in project.readOnly_refs or []
				members.push { id: member_id.toString(), privilegeLevel: PrivilegeLevels.READ_ONLY }
			for member_id in project.collaberator_refs or []
				members.push { id: member_id.toString(), privilegeLevel: PrivilegeLevels.READ_AND_WRITE }
			return callback null, members

	getMemberIds: (project_id, callback = (error, member_ids) ->) ->
		CollaboratorsInviteHandler.getMemberIdsWithPrivilegeLevels project_id, (error, members) ->
			return callback(error) if error?
			return callback null, members.map (m) -> m.id

	getMembersWithPrivilegeLevels: (project_id, callback = (error, members) ->) ->
		CollaboratorsInviteHandler.getMemberIdsWithPrivilegeLevels project_id, (error, members = []) ->
			return callback(error) if error?
			result = []
			async.mapLimit members, 3,
				(member, cb) ->
					UserGetter.getUser member.id, (error, user) ->
						return cb(error) if error?
						if user?
							result.push { user: user, privilegeLevel: member.privilegeLevel }
						cb()
				(error) ->
					return callback(error) if error?
					callback null, result

	getMemberIdPrivilegeLevel: (user_id, project_id, callback = (error, privilegeLevel) ->) ->
		# In future if the schema changes and getting all member ids is more expensive (multiple documents)
		# then optimise this.
		CollaboratorsInviteHandler.getMemberIdsWithPrivilegeLevels project_id, (error, members = []) ->
			return callback(error) if error?
			for member in members
				if member.id == user_id?.toString()
					return callback null, member.privilegeLevel
			return callback null, PrivilegeLevels.NONE

	getMemberCount: (project_id, callback = (error, count) ->) ->
		CollaboratorsInviteHandler.getMemberIdsWithPrivilegeLevels project_id, (error, members) ->
			return callback(error) if error?
			return callback null, (members or []).length

	getCollaboratorCount: (project_id, callback = (error, count) ->) ->
		CollaboratorsInviteHandler.getMemberCount project_id, (error, count) ->
			return callback(error) if error?
			return callback null, count - 1 # Don't count project owner

	isUserMemberOfProject: (user_id, project_id, callback = (error, isMember, privilegeLevel) ->) ->
		CollaboratorsInviteHandler.getMemberIdsWithPrivilegeLevels project_id, (error, members = []) ->
			return callback(error) if error?
			for member in members
				if member.id.toString() == user_id.toString()
					return callback null, true, member.privilegeLevel
			return callback null, false, null

	getProjectsUserIsCollaboratorOf: (user_id, fields, callback = (error, readAndWriteProjects, readOnlyProjects) ->) ->
		Project.find {collaberator_refs:user_id}, fields, (err, readAndWriteProjects)=>
			return callback(err) if err?
			Project.find {readOnly_refs:user_id}, fields, (err, readOnlyProjects)=>
				return callback(err) if err?
				callback(null, readAndWriteProjects, readOnlyProjects)

	# public functions
	inviteToProject: (projectId, sendingUserId, email, priveleges, callback=(err,invite)->) ->

	revokeInvite: (projectId, inviteId, callback=(err)->) ->

	getInviteByToken: (projectId, tokenString, callback=(err,invite)->) ->

	acceptInvite: (projectId, inviteId, callback=(err)->) ->
