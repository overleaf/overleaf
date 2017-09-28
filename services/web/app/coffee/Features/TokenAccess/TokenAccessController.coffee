ProjectGetter = require "../Project/ProjectGetter"
ProjectController = require "../Project/ProjectController"
ProjectEditorHandler = require "../Project/ProjectEditorHandler"
UserGetter = require "../User/UserGetter"
AuthenticationController = require '../Authentication/AuthenticationController'
logger = require 'logger-sharelatex'
TokenAccessHandler = require './TokenAccessHandler'
Errors = require '../Errors/Errors'


module.exports = TokenAccessController =

	readAndWriteToken: (req, res, next) ->
		userId = AuthenticationController.getLoggedInUserId(req)
		token = req.params['read_and_write_token']
		logger.log {userId, token}, "requesting read-and-write token access"
		TokenAccessHandler.findProjectWithReadAndWriteToken token, (err, project) ->
			if err?
				logger.err {err, token, userId},
					"error getting project by readAndWrite token"
				return next(err)
			if !project?
				logger.log {token, userId},
					"no project found for readAndWrite token"
				return next(new Errors.NotFoundError())
			logger.log {userId, projectId: project._id},
				"adding user to project with readAndWrite token"
			TokenAccessHandler.addReadAndWriteUserToProject userId, project._id, (err) ->
				if err?
					logger.err {err, token, userId, projectId: project._id},
						"error adding user to project with readAndWrite token"
					return next(err)
				req.params.Project_id = project._id.toString()
				return ProjectController.loadEditor(req, res, next)

	readOnlyToken: (req, res, next) ->
		userId = AuthenticationController.getLoggedInUserId(req)
		token = req.params['read_only_token']
		logger.log {userId, token}, "requesting read-only token access"
		TokenAccessHandler.findProjectWithReadOnlyToken token, (err, project) ->
			if err?
				logger.err {err, token, user_id: currentUserId},
					"error getting project by readOnly token"
				return next(err)
			if !project?
				logger.log {token, userId},
					"no project found for readAndWrite token"
				return next(new Errors.NotFoundError())
			if !userId?
				logger.log {userId, projectId: project._id},
					"adding anonymous user to project with readOnly token"
				TokenAccessHandler.grantSessionReadOnlyTokenAccess(req, project._id, token)
				req.params.Project_id = project._id.toString()
				return ProjectController.loadEditor(req, res, next)
			else
				logger.log {userId, projectId: project._id},
					"adding user to project with readOnly token"
				TokenAccessHandler.addReadOnlyUserToProject userId, project._id, (err) ->
					if err?
						logger.err {err, token, userId, projectId: project._id},
							"error adding user to project with readAndWrite token"
						return next(err)
					req.params.Project_id = project._id.toString()
					return ProjectController.loadEditor(req, res, next)


