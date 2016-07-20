ProjectGetter = require "../Project/ProjectGetter"
LimitationsManager = require "../Subscription/LimitationsManager"
UserGetter = require "../User/UserGetter"
CollaboratorsInviteHandler = require('./CollaboratorsInviteHandler')
mimelib = require("mimelib")
logger = require('logger-sharelatex')

module.exports = CollaboratorsInviteController =

	inviteToProject: (req, res, next) ->
		projectId = req.params.Project_id
		email = req.body.email
		sendingUserId = req.session?.user_id
		logger.log {projectId, email, sendingUserId}, "inviting to project"
		LimitationsManager.canAddXCollaborators project_id, 1, (error, allowed) =>
			return next(error) if error?
			if !allowed
				logger.log {projectId, email, sendingUserId}, "not allowed to invite any more users to this project"
				return res.json {}
			{email, privileges} = req.body
			email = mimelib.parseAddresses(email or "")[0]?.address?.toLowerCase()
			if !email? or email == ""
				logger.log {projectId, email, sendingUserId}, "invalid email address"
				return res.status(400).send("invalid email address")
			CollaboratorsInviteHandler.inviteToProject projectId, sendingUserId, email, priveleges, (err, invite) ->
				if err?
					logger.err {projectId, email, sendingUserId}, "error creating project invite"
					return next(err)
				logger.log {projectId, email, sendingUserId}, "invite created"
				return res.json {inviteId: invite._id}

	revokeInvite: (req, res, next) ->

	viewInvite: (req, res, next) ->

	acceptInvite: (req, res, next) ->
