Project = require("../../models/Project").Project
ProjectInvite = require("../../models/ProjectInvite").ProjectInvite
mimelib = require("mimelib")
logger = require('logger-sharelatex')
ContactManager = require "../Contacts/ContactManager"
CollaboratorsEmailHandler = require "./CollaboratorsEmailHandler"
Async = require "async"
PrivilegeLevels = require "../Authorization/PrivilegeLevels"
Errors = require "../Errors/Errors"
Crypto = require 'crypto'

module.exports = CollaboratorsInviteHandler =

	inviteToProject: (projectId, sendingUserId, email, privileges, callback=(err,invite)->) ->
		logger.log {projectId, sendingUserId, email, privileges}, "adding invite"
		Crypto.randomBytes 24, (err, buffer) ->
			if err?
				logger.err {err, projectId, sendingUserId, email}, "error generating random token"
				return callback(err)
			token = buffer.toString('hex')
			invite = new ProjectInvite {
				email: email
				token: token
				sendingUserId: sendingUserId
				projectId: projectId
				privileges: privileges
			}
			invite.save (err, invite) ->
				if err?
					logger.err {err, projectId, sendingUserId, email}, "error saving token"
					return callback(err)
				CollaboratorsEmailHandler.notifyUserOfProjectInvite projectId, email, invite
				callback(null, invite)

	revokeInvite: (projectId, inviteId, callback=(err)->) ->
		logger.log {projectId, inviteId}, "removing invite"
		ProjectInvite.remove {projectId: projectId, _id: inviteId}, (err) ->
			if err?
				logger.err {err, projectId, inviteId}, "error removing invite"
				return callback(err)
			callback(null)

	getInviteByToken: (projectId, tokenString, callback=(err,invite)->) ->
		logger.log {projectId, tokenString}, "fetching invite by token"
		ProjectInvite.findOne {projectId: projectId, token: tokenString}, (err, invite) ->
			if err?
				logger.err {err, projectId}, "error fetching invite"
				return callback(err)
			if !invite
				logger.err {err, projectId, token: tokenString}, "no invite found"
				return callback(null, null)
			callback(null, invite)

	acceptInvite: (projectId, inviteId, tokenString, user, callback=(err)->) ->
		Project.findOne {_id: projectId}, (err, project) ->
			if err?
				logger.err {err, projectId}, "error finding project"
				return callback(err)
			if !project
				err = new Errors.NotFoundError("no project found for invite")
				logger.log {err, projectId, inviteId}, "no project found"
				return callback(err)
			# TODO: check if we need to cast the ids to ObjectId
			ProjectInvite.findOne {_id: inviteId, projectId: projectId, token: token}, (err, invite) ->
				if err?
					logger.err {err, projectId, inviteId}, "error finding invite"
					return callback(err)
				if !invite
					err = new Errors.NotFoundError("no matching invite found")
					logger.log {err, projectId, inviteId}, "no matching invite found"
					return callback(err)

				now = new Date()
				if invite.expiresAt < now
					err = new Errors.NotFoundError("invite expired")
					logger.log {err, projectId, inviteId, expiresAt: invite.expiresAt}, "invite expired"
					return callback(err)

				# do the thing
				existing_users = (project.collaberator_refs or [])
				existing_users = existing_users.concat(project.readOnly_refs or [])
				existing_users = existing_users.map (u) -> u.toString()
				if existing_users.indexOf(user._id.toString()) > -1
					return callback null # User already in Project

				privilegeLevel = invite.privileges

				if privilegeLevel == PrivilegeLevels.READ_AND_WRITE
					level = {"collaberator_refs": user._id}
					logger.log {privileges: privilegeLevel, user_id: user._id, projectId}, "adding user"
				else if privilegeLevel == PrivilegeLevels.READ_ONLY
					level = {"readOnly_refs": user._id}
					logger.log {privileges: privilegeLevel, user_id: user._id, projectId}, "adding user"
				else
					return callback(new Error("unknown privilegeLevel: #{privilegeLevel}"))

				ContactManager.addContact invite.sendingUserId, user._id

				Project.update { _id: project._id }, { $addToSet: level }, (error) ->
					return callback(error) if error?
					# Flush to TPDS in background to add files to collaborator's Dropbox
					ProjectEntityHandler = require("../Project/ProjectEntityHandler")
					ProjectEntityHandler.flushProjectToThirdPartyDataStore project_id, (error) ->
						if error?
							logger.error {err: error, project_id, user_id}, "error flushing to TPDS after adding collaborator"
					# Remove invite
					ProjectInvite.remove {_id: inviteId}, (err) ->
						if err?
							logger.err {err, projectId, inviteId}, "error removing invite"
							return callback(err)
						callback()
