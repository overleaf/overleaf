ProjectInvite = require("../../models/ProjectInvite").ProjectInvite
logger = require('logger-sharelatex')
CollaboratorsEmailHandler = require "./CollaboratorsEmailHandler"
CollaboratorsHandler = require "./CollaboratorsHandler"
UserGetter = require "../User/UserGetter"
ProjectGetter = require "../Project/ProjectGetter"
Async = require "async"
PrivilegeLevels = require "../Authorization/PrivilegeLevels"
Errors = require "../Errors/Errors"
Crypto = require 'crypto'
NotificationsBuilder = require("../Notifications/NotificationsBuilder")


module.exports = CollaboratorsInviteHandler =

	getAllInvites: (projectId, callback=(err, invites)->) ->
		logger.log {projectId}, "fetching invites for project"
		ProjectInvite.find {projectId: projectId}, (err, invites) ->
			if err?
				logger.err {err, projectId}, "error getting invites from mongo"
				return callback(err)
			logger.log {projectId, count: invites.length}, "found invites for project"
			callback(null, invites)

	getInviteCount: (projectId, callback=(err, count)->) ->
		logger.log {projectId}, "counting invites for project"
		ProjectInvite.count {projectId: projectId}, (err, count) ->
			if err?
				logger.err {err, projectId}, "error getting invites from mongo"
				return callback(err)
			callback(null, count)

	_trySendInviteNotification: (projectId, sendingUser, invite, callback=(err)->) ->
		email = invite.email
		UserGetter.getUser {email: email}, {_id: 1}, (err, existingUser) ->
			if err?
				logger.err {projectId, email}, "error checking if user exists"
				return callback(err)
			if !existingUser?
				logger.log {projectId, email}, "no existing user found, returning"
				return callback(null)
			ProjectGetter.getProject projectId, {_id: 1, name: 1}, (err, project) ->
				if err?
					logger.err {projectId, email}, "error getting project"
					return callback(err)
				if !project?
					logger.log {projectId}, "no project found while sending notification, returning"
					return callback(null)
				NotificationsBuilder.projectInvite(invite, project, sendingUser, existingUser).create(callback)

	_tryCancelInviteNotification: (inviteId, callback=()->) ->
			NotificationsBuilder.projectInvite({_id: inviteId}, null, null, null).read(callback)

	_sendMessages: (projectId, sendingUser, invite, callback=(err)->) ->
		logger.log {projectId, inviteId: invite._id}, "sending notification and email for invite"
		CollaboratorsEmailHandler.notifyUserOfProjectInvite projectId, invite.email, invite, (err)->
			return callback(err) if err?
			CollaboratorsInviteHandler._trySendInviteNotification projectId, sendingUser, invite, (err)->
				return callback(err) if err?
				callback()

	inviteToProject: (projectId, sendingUser, email, privileges, callback=(err,invite)->) ->
		logger.log {projectId, sendingUserId: sendingUser._id, email, privileges}, "adding invite"
		Crypto.randomBytes 24, (err, buffer) ->
			if err?
				logger.err {err, projectId, sendingUserId: sendingUser._id, email}, "error generating random token"
				return callback(err)
			token = buffer.toString('hex')
			invite = new ProjectInvite {
				email: email
				token: token
				sendingUserId: sendingUser._id
				projectId: projectId
				privileges: privileges
			}
			invite.save (err, invite) ->
				if err?
					logger.err {err, projectId, sendingUserId: sendingUser._id, email}, "error saving token"
					return callback(err)
				# Send email and notification in background
				CollaboratorsInviteHandler._sendMessages projectId, sendingUser, invite, (err) ->
					if err?
						logger.err {projectId, email}, "error sending messages for invite"
				callback(null, invite)


	revokeInvite: (projectId, inviteId, callback=(err)->) ->
		logger.log {projectId, inviteId}, "removing invite"
		ProjectInvite.remove {projectId: projectId, _id: inviteId}, (err) ->
			if err?
				logger.err {err, projectId, inviteId}, "error removing invite"
				return callback(err)
			CollaboratorsInviteHandler._tryCancelInviteNotification(inviteId, ()->)
			callback(null)

	resendInvite: (projectId, sendingUser, inviteId, callback=(err)->) ->
		logger.log {projectId, inviteId}, "resending invite email"
		ProjectInvite.findOne {_id: inviteId, projectId: projectId}, (err, invite) ->
			if err?
				logger.err {err, projectId, inviteId}, "error finding invite"
				return callback(err)
			if !invite?
				logger.err {err, projectId, inviteId}, "no invite found, nothing to resend"
				return callback(null)
			CollaboratorsInviteHandler._sendMessages projectId, sendingUser, invite, (err) ->
				if err?
					logger.err {projectId, inviteId}, "error resending invite messages"
					return callback(err)
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

	acceptInvite: (projectId, tokenString, user, callback=(err)->) ->
		logger.log {projectId, userId: user._id, tokenString}, "accepting invite"
		CollaboratorsInviteHandler.getInviteByToken projectId, tokenString, (err, invite) ->
			if err?
				logger.err {err, projectId, tokenString}, "error finding invite"
				return callback(err)
			if !invite
				err = new Errors.NotFoundError("no matching invite found")
				logger.log {err, projectId, tokenString}, "no matching invite found"
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
					CollaboratorsInviteHandler._tryCancelInviteNotification inviteId, ()->
					callback()
