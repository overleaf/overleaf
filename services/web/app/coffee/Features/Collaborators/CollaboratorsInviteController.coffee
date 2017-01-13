ProjectGetter = require "../Project/ProjectGetter"
LimitationsManager = require "../Subscription/LimitationsManager"
UserGetter = require "../User/UserGetter"
CollaboratorsHandler = require('./CollaboratorsHandler')
CollaboratorsInviteHandler = require('./CollaboratorsInviteHandler')
logger = require('logger-sharelatex')
Settings = require('settings-sharelatex')
EmailHelper = require "../Helpers/EmailHelper"
EditorRealTimeController = require("../Editor/EditorRealTimeController")
NotificationsBuilder = require("../Notifications/NotificationsBuilder")
AnalyticsManger = require("../Analytics/AnalyticsManager")
AuthenticationController = require("../Authentication/AuthenticationController")

module.exports = CollaboratorsInviteController =

	getAllInvites: (req, res, next) ->
		projectId = req.params.Project_id
		logger.log {projectId}, "getting all active invites for project"
		CollaboratorsInviteHandler.getAllInvites projectId, (err, invites) ->
			if err?
				logger.err {projectId}, "error getting invites for project"
				return next(err)
			res.json({invites: invites})

	_checkShouldInviteEmail: (email, callback=(err, shouldAllowInvite)->) ->
		if Settings.restrictInvitesToExistingAccounts == true
			logger.log {email}, "checking if user exists with this email"
			UserGetter.getUser {email: email}, {_id: 1}, (err, user) ->
				return callback(err) if err?
				userExists = user? and user?._id?
				callback(null, userExists)
		else
			callback(null, true)

	inviteToProject: (req, res, next) ->
		projectId = req.params.Project_id
		email = req.body.email
		sendingUser = AuthenticationController.getSessionUser(req)
		sendingUserId = sendingUser._id
		logger.log {projectId, email, sendingUserId}, "inviting to project"
		LimitationsManager.canAddXCollaborators projectId, 1, (error, allowed) =>
			return next(error) if error?
			if !allowed
				logger.log {projectId, email, sendingUserId}, "not allowed to invite more users to project"
				return res.json {invite: null}
			{email, privileges} = req.body
			email = EmailHelper.parseEmail(email)
			if !email? or email == ""
				logger.log {projectId, email, sendingUserId}, "invalid email address"
				return res.sendStatus(400)
			CollaboratorsInviteController._checkShouldInviteEmail email, (err, shouldAllowInvite)->
				if err?
					logger.err {err, email, projectId, sendingUserId}, "error checking if we can invite this email address"
					return next(err)
				if !shouldAllowInvite
					logger.log {email, projectId, sendingUserId}, "not allowed to send an invite to this email address"
					return res.json {invite: null, error: 'cannot_invite_non_user'}
				CollaboratorsInviteHandler.inviteToProject projectId, sendingUser, email, privileges, (err, invite) ->
					if err?
						logger.err {projectId, email, sendingUserId}, "error creating project invite"
						return next(err)
					logger.log {projectId, email, sendingUserId}, "invite created"
					EditorRealTimeController.emitToRoom(projectId, 'project:membership:changed', {invites: true})
					return res.json {invite: invite}

	revokeInvite: (req, res, next) ->
		projectId = req.params.Project_id
		inviteId = req.params.invite_id
		logger.log {projectId, inviteId}, "revoking invite"
		CollaboratorsInviteHandler.revokeInvite projectId, inviteId, (err) ->
			if err?
				logger.err {projectId, inviteId}, "error revoking invite"
				return next(err)
			EditorRealTimeController.emitToRoom projectId, 'project:membership:changed', {invites: true}
			res.sendStatus(201)

	resendInvite: (req, res, next) ->
		projectId = req.params.Project_id
		inviteId = req.params.invite_id
		logger.log {projectId, inviteId}, "resending invite"
		sendingUser = AuthenticationController.getSessionUser(req)
		CollaboratorsInviteHandler.resendInvite projectId, sendingUser, inviteId, (err) ->
			if err?
				logger.err {projectId, inviteId}, "error resending invite"
				return next(err)
			res.sendStatus(201)

	viewInvite: (req, res, next) ->
		projectId = req.params.Project_id
		token = req.params.token
		_renderInvalidPage = () ->
			logger.log {projectId, token}, "invite not valid, rendering not-valid page"
			res.render "project/invite/not-valid", {title: "Invalid Invite"}
		# check if the user is already a member of the project
		currentUser = AuthenticationController.getSessionUser(req)
		CollaboratorsHandler.isUserMemberOfProject currentUser._id, projectId, (err, isMember, _privilegeLevel) ->
			if err?
				logger.err {err, projectId}, "error checking if user is member of project"
				return next(err)
			if isMember
				logger.log {projectId, userId: currentUser._id}, "user is already a member of this project, redirecting"
				return res.redirect "/project/#{projectId}"
			# get the invite
			CollaboratorsInviteHandler.getInviteByToken projectId, token, (err, invite) ->
				if err?
					logger.err {projectId, token}, "error getting invite by token"
					return next(err)
				# check if invite is gone, or otherwise non-existent
				if !invite?
					logger.log {projectId, token}, "no invite found for this token"
					return _renderInvalidPage()
				# check the user who sent the invite exists
				UserGetter.getUser {_id: invite.sendingUserId}, {email: 1, first_name: 1, last_name: 1}, (err, owner) ->
					if err?
						logger.err {err, projectId}, "error getting project owner"
						return next(err)
					if !owner?
						logger.log {projectId}, "no project owner found"
						return _renderInvalidPage()
					# fetch the project name
					ProjectGetter.getProject projectId, {}, (err, project) ->
						if err?
							logger.err {err, projectId}, "error getting project"
							return next(err)
						if !project?
							logger.log {projectId}, "no project found"
							return _renderInvalidPage()
						# finally render the invite
						res.render "project/invite/show", {invite, project, owner, title: "Project Invite"}

	acceptInvite: (req, res, next) ->
		projectId = req.params.Project_id
		token = req.params.token
		currentUser = AuthenticationController.getSessionUser(req)
		logger.log {projectId, userId: currentUser._id, token}, "got request to accept invite"
		CollaboratorsInviteHandler.acceptInvite projectId, token, currentUser, (err) ->
			if err?
				logger.err {projectId, token}, "error accepting invite by token"
				return next(err)
			EditorRealTimeController.emitToRoom projectId, 'project:membership:changed', {invites: true, members: true}
			AnalyticsManger.recordEvent(currentUser._id, "project-invite-accept", {projectId:projectId, userId:currentUser._id})
			if req.xhr
				res.sendStatus 204 #  Done async via project page notification
			else
				res.redirect "/project/#{projectId}"
