ProjectController = require "../Project/ProjectController"
AuthenticationController = require '../Authentication/AuthenticationController'
TokenAccessHandler = require './TokenAccessHandler'
V1Api = require '../V1/V1Api'
Errors = require '../Errors/Errors'
logger = require 'logger-sharelatex'
settings = require 'settings-sharelatex'

module.exports = TokenAccessController =

	_loadEditor: (projectId, req, res, next) ->
		req.params.Project_id = projectId.toString()
		return ProjectController.loadEditor(req, res, next)

	_tryHigherAccess: (token, userId, req, res, next) ->
		TokenAccessHandler.findProjectWithHigherAccess token, userId, (err, project) ->
			if err?
				logger.err {err, token, userId},
					"[TokenAccess] error finding project with higher access"
				return next(err)
			if !project?
				logger.log {token, userId},
					"[TokenAccess] no project with higher access found for this user and token"
				return next(new Errors.NotFoundError())
			logger.log {token, userId, projectId: project._id},
				"[TokenAccess] user has higher access to project, redirecting"
			res.redirect(302, "/project/#{project._id}")

	readAndWriteToken: (req, res, next) ->
		userId = AuthenticationController.getLoggedInUserId(req)
		token = req.params['read_and_write_token']
		logger.log {userId, token}, "[TokenAccess] requesting read-and-write token access"
		TokenAccessHandler.findProjectWithReadAndWriteToken token, (err, project, projectExists) ->
			if err?
				logger.err {err, token, userId},
					"[TokenAccess] error getting project by readAndWrite token"
				return next(err)
			if !projectExists and settings.overleaf
				logger.log {token, userId},
					"[TokenAccess] no project found for this token"
				TokenAccessHandler.checkV1ProjectExported token, (err, exported) ->
					return next err if err?
					return next(new Errors.NotFoundError()) if exported
					return res.redirect(302, "/sign_in_to_v1?return_to=/#{token}")
			else if !project?
				logger.log {token, userId},
					"[TokenAccess] no token-based project found for readAndWrite token"
				if !userId?
					logger.log {token},
						"[TokenAccess] No project found with read-write token, anonymous user, deny"
					return next(new Errors.NotFoundError())
				TokenAccessController._tryHigherAccess(token, userId, req, res, next)
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
						AuthenticationController._setRedirectInSession(req)
						return res.redirect('/restricted')
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
					return TokenAccessController._loadEditor(project._id, req, res, next)

	readOnlyToken: (req, res, next) ->
		userId = AuthenticationController.getLoggedInUserId(req)
		token = req.params['read_only_token']
		logger.log {userId, token}, "[TokenAccess] requesting read-only token access"
		TokenAccessHandler.findProjectWithReadOnlyToken token, (err, project, projectExists) ->
			if err?
				logger.err {err, token, userId},
					"[TokenAccess] error getting project by readOnly token"
				return next(err)
			if !projectExists and settings.overleaf
				logger.log {token, userId},
						"[TokenAccess] no project found for this token"
				return res.redirect(302, settings.overleaf.host + '/read/' + token)
			if !project?
				logger.log {token, userId},
					"[TokenAccess] no project found for readOnly token"
				if !userId?
					logger.log {token},
						"[TokenAccess] No project found with readOnly token, anonymous user, deny"
					return next(new Errors.NotFoundError())
				TokenAccessController._tryHigherAccess(token, userId, req, res, next)
			else
				TokenAccessHandler.checkV1Access token, (err, allow_access, redirect_path) ->
					return next err if err?
					return res.redirect redirect_path unless allow_access
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

