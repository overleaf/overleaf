ProjectGetter = require "../Project/ProjectGetter"
ProjectEditorHandler = require "../Project/ProjectEditorHandler"
UserGetter = require "../User/UserGetter"
AuthenticationController = require '../Authentication/AuthenticationController'
logger = require 'logger-sharelatex'
TokenAccessHandler = require './TokenAccessHandler'


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
				return res.sendStatus(404)
			logger.log {userId, projectId: project._id},
				"adding user to project with readAndWrite token"
			TokenAccessHandler.addReadAndWriteUserToProject userId, project._id, (err) ->
				if err?
					logger.err {err, token, userId, projectId: project._id},
						"error adding user to project with readAndWrite token"
					return next(err)
				return res.redirect(307, "/project/#{project._id}")

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
				return res.sendStatus(404)
			if !userId?
				logger.log {userId, projectId: project._id},
					"adding anonymous user to project with readOnly token"
				TokenAccessHandler.grantSessionReadOnlyTokenAccess(req, project._id, token)
				return res.redirect(307, "/project/#{project._id}")
			else
				logger.log {userId, projectId: project._id},
					"adding user to project with readOnly token"
				TokenAccessHandler.addReadOnlyUserToProject userId, project._id, (err) ->
					if err?
						logger.err {err, token, userId, projectId: project._id},
							"error adding user to project with readAndWrite token"
						return next(err)
					res.redirect(307, "/project/#{project._id}")


