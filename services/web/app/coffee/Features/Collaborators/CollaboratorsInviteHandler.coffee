ProjectInvite = require("../../models/ProjectInvite").ProjectInvite
logger = require('logger-sharelatex')
CollaboratorsEmailHandler = require "./CollaboratorsEmailHandler"
CollaboratorsHandler = require "./CollaboratorsHandler"
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

	getInviteCount: (projectId, callback=(err, count)->) ->
		logger.log {projectId}, "counting invites for project"
		ProjectInvite.count {projectId: projectId}, (err, count) ->
			if err?
				logger.err {err, projectId}, "error getting invites from mongo"
				return callback(err)
			callback(null, count)

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

	resendInvite: (projectId, inviteId, callback=(err)->) ->
		logger.log {projectId, inviteId}, "resending invite email"
		ProjectInvite.findOne {_id: inviteId, projectId: projectId}, (err, invite) ->
			if err?
				logger.err {err, projectId, inviteId}, "error finding invite"
				return callback(err)
			if !invite?
				logger.err {err, projectId, inviteId}, "no invite found, nothing to resend"
				return callback(null)
			CollaboratorsEmailHandler.notifyUserOfProjectInvite projectId, invite.email, invite
			callback(null)

	getInviteByToken: (projectId, tokenString, callback=(err,invite)->) ->
		logger.log {projectId, tokenString}, "fetching invite by token"
		ProjectInvite.findOne {projectId: projectId, token: tokenString}, (err, invite) ->
			if err?
				logger.err {err, projectId}, "error fetching invite"
				return callback(err)
			if !invite?
				logger.err {err, projectId, token: tokenString}, "no invite found"
				return callback(null, null)
			callback(null, invite)

	acceptInvite: (projectId, inviteId, tokenString, user, callback=(err)->) ->
		logger.log {projectId, inviteId, userId: user._id}, "accepting invite"
		CollaboratorsInviteHandler.getInviteByToken projectId, tokenString, (err, invite) ->
			if err?
				logger.err {err, projectId, inviteId}, "error finding invite"
				return callback(err)
			if !invite
				err = new Errors.NotFoundError("no matching invite found")
				logger.log {err, projectId, inviteId, tokenString}, "no matching invite found"
				return callback(err)
			inviteId = invite._id
			CollaboratorsHandler.addUserIdToProject projectId, invite.sendingUserId, user._id, invite.privileges, (err) ->
				if err?
					logger.err {err, projectId, inviteId, userId: user._id}, "error adding user to project"
					return callback(err)
				# Remove invite
				logger.log {projectId, inviteId}, "removing invite"
				ProjectInvite.remove {_id: inviteId}, (err) ->
					if err?
						logger.err {err, projectId, inviteId}, "error removing invite"
						return callback(err)
					callback()
