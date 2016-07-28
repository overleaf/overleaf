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

	getAllInvites: (projectId, callback=(err, invites)->) ->
		logger.log {projectId}, "fetching invites from mongo"
		ProjectInvite.find {projectId: projectId}, (err, invites) ->
			if err?
				logger.err {err, projectId}, "error getting invites from mongo"
				return callback(err)
			callback(null, invites)

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
		# fetch the target project
		Project.findOne {_id: projectId}, (err, project) ->
			if err?
				logger.err {err, projectId}, "error finding project"
				return callback(err)
			if !project
				err = new Errors.NotFoundError("no project found for invite")
				logger.log {err, projectId, inviteId}, "no project found"
				return callback(err)
			# fetch the invite
			ProjectInvite.findOne {_id: inviteId, projectId: projectId, token: tokenString}, (err, invite) ->
				if err?
					logger.err {err, projectId, inviteId}, "error finding invite"
					return callback(err)
				if !invite
					err = new Errors.NotFoundError("no matching invite found")
					logger.log {err, projectId, inviteId, tokenString}, "no matching invite found"
					return callback(err)

				# build an update to be applied with $addToSet, user is added to either
				# `collaberator_refs` or `readOnly_refs`
				privilegeLevel = invite.privileges
				if privilegeLevel == PrivilegeLevels.READ_AND_WRITE
					level = {"collaberator_refs": user._id}
					logger.log {privileges: privilegeLevel, user_id: user._id, projectId}, "adding user with read-write access"
				else if privilegeLevel == PrivilegeLevels.READ_ONLY
					level = {"readOnly_refs": user._id}
					logger.log {privileges: privilegeLevel, user_id: user._id, projectId}, "adding user with read-only access"
				else
					return callback(new Error("unknown privilegeLevel: #{privilegeLevel}"))

				ContactManager.addContact invite.sendingUserId, user._id

				# Update the project, adding the new member. We don't check if the user is already a member of the project,
				# because even if they are we still want to have them 'accept' the invite and go through the usual process,
				# despite the $addToSet operation having no meaningful effect
				Project.update { _id: project._id }, { $addToSet: level }, (error) ->
					return callback(error) if error?
					# Flush to TPDS in background to add files to collaborator's Dropbox
					ProjectEntityHandler = require("../Project/ProjectEntityHandler")
					ProjectEntityHandler.flushProjectToThirdPartyDataStore project._id, (error) ->
						if error?
							logger.error {err: error, project_id: project._id, user_id}, "error flushing to TPDS after adding collaborator"
					# Remove invite
					ProjectInvite.remove {_id: inviteId}, (err) ->
						if err?
							logger.err {err, projectId, inviteId}, "error removing invite"
							return callback(err)
						callback()
