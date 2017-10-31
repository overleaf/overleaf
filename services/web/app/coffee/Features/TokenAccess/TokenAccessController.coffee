ProjectController = require "../Project/ProjectController"
AuthenticationController = require '../Authentication/AuthenticationController'
TokenAccessHandler = require './TokenAccessHandler'
EditorRealTimeController = require "../Editor/EditorRealTimeController"
Errors = require '../Errors/Errors'
logger = require 'logger-sharelatex'

module.exports = TokenAccessController =

	_loadEditor: (projectId, req, res, next) ->
		req.params.Project_id = projectId.toString()
		return ProjectController.loadEditor(req, res, next)

	readAndWriteToken: (req, res, next) ->
		userId = AuthenticationController.getLoggedInUserId(req)
		token = req.params['read_and_write_token']
		logger.log {userId, token}, "[TokenAccess] requesting read-and-write token access"
		TokenAccessHandler.findProjectWithReadAndWriteToken token, (err, project) ->
			if err?
				logger.err {err, token, userId},
					"[TokenAccess] error getting project by readAndWrite token"
				return next(err)
			if !project?
				logger.log {token, userId},
					"[TokenAccess] no project found for readAndWrite token"
				if !userId?
					logger.log {token},
						"[TokenAccess] No project found with read-write token, anonymous user"
					return next(new Errors.NotFoundError())
				TokenAccessHandler
					.findPrivateOverleafProjectWithReadAndWriteToken token, (err, project) ->
						if err?
							logger.err {err, token, userId},
								"[TokenAccess] error getting project by readAndWrite token"
							return next(err)
						if !project?
							logger.log {token, userId},
								"[TokenAccess] no private-overleaf project found with readAndWriteToken"
							return next(new Errors.NotFoundError())
						logger.log {token, projectId: project._id}, "[TokenAccess] redirecting user to project"
						res.redirect(302, "/project/#{project._id}")
			else
				if !userId?
					if TokenAccessHandler.ANONYMOUS_READ_AND_WRITE_ENABLED
						logger.log {token, projectId: project._id},
							"[TokenAccess] allow anonymous read-and-write token access"
						TokenAccessHandler.grantSessionTokenAccess(req, project._id, token)
						req._anonymousAccessToken = token
						return TokenAccessController._loadEditor(project._id, req, res, next)
					else
						logger.log {token, projectId: project._id},
							"[TokenAccess] deny anonymous read-and-write token access"
						return next(new Errors.NotFoundError())
				if project.owner_ref.toString() == userId
					logger.log {userId, projectId: project._id},
						"[TokenAccess] user is already project owner"
					return TokenAccessController._loadEditor(project._id, req, res, next)
				logger.log {userId, projectId: project._id},
					"[TokenAccess] adding user to project with readAndWrite token"
				TokenAccessHandler.addReadAndWriteUserToProject userId, project._id, (err) ->
					if err?
						logger.err {err, token, userId, projectId: project._id},
							"[TokenAccess] error adding user to project with readAndWrite token"
						return next(err)
					# TODO: check if this is still needed by the client
					setTimeout( () ->
						EditorRealTimeController.emitToRoom(
							'project:membership:changed',
							{tokenMembers: true}
						)
					, 1000)
					return TokenAccessController._loadEditor(project._id, req, res, next)

	readOnlyToken: (req, res, next) ->
		userId = AuthenticationController.getLoggedInUserId(req)
		token = req.params['read_only_token']
		logger.log {userId, token}, "[TokenAccess] requesting read-only token access"
		TokenAccessHandler.findProjectWithReadOnlyToken token, (err, project) ->
			if err?
				logger.err {err, token, userId},
					"[TokenAccess] error getting project by readOnly token"
				return next(err)
			if !project?
				logger.log {token, userId},
					"[TokenAccess] no project found for readAndWrite token"
				return next(new Errors.NotFoundError())
			if !userId?
				logger.log {userId, projectId: project._id},
					"[TokenAccess] adding anonymous user to project with readOnly token"
				TokenAccessHandler.grantSessionTokenAccess(req, project._id, token)
				req._anonymousAccessToken = token
				return TokenAccessController._loadEditor(project._id, req, res, next)
			else
				if project.owner_ref.toString() == userId
					logger.log {userId, projectId: project._id},
						"[TokenAccess] user is already project owner"
					return TokenAccessController._loadEditor(project._id, req, res, next)
				logger.log {userId, projectId: project._id},
					"[TokenAccess] adding user to project with readOnly token"
				TokenAccessHandler.addReadOnlyUserToProject userId, project._id, (err) ->
					if err?
						logger.err {err, token, userId, projectId: project._id},
							"[TokenAccess] error adding user to project with readAndWrite token"
						return next(err)
					return TokenAccessController._loadEditor(project._id, req, res, next)

