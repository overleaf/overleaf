UserCreator = require('../User/UserCreator')
Project = require("../../models/Project").Project
ProjectInvite = require("../../models/ProjectInvite").ProjectInvite
mimelib = require("mimelib")
logger = require('logger-sharelatex')
UserGetter = require "../User/UserGetter"
ContactManager = require "../Contacts/ContactManager"
CollaboratorsEmailHandler = require "./CollaboratorsEmailHandler"
Async = require "async"
PrivilegeLevels = require "../Authorization/PrivilegeLevels"
Errors = require "../Errors/Errors"
Crypto = require 'crypto'

module.experts = CollaboratorsInviteHandler =

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
			ProjectInvite.save (err) ->
				if err?
					logger.err {err, projectId, sendingUserId, email}, "error saving token"
					return callback(err)
				CollaboratorsEmailHandler.notifyUserOfProjectInvite projectId, email, invite
				callback(null, invite)

	revokeInvite: (projectId, inviteId, callback=(err)->) ->

	getInviteByToken: (projectId, tokenString, callback=(err,invite)->) ->

	acceptInvite: (projectId, inviteId, callback=(err)->) ->
