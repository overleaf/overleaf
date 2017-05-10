UserLocator = require "../User/UserLocator"
Settings = require "settings-sharelatex"
logger = require 'logger-sharelatex'
SudoModeHandler = require './SudoModeHandler'
AuthenticationController = require '../Authentication/AuthenticationController'
AuthenticationManager = require '../Authentication/AuthenticationManager'
ObjectId = require('../../infrastructure/Mongoose').mongo.ObjectId
UserGetter = require '../User/UserGetter'


module.exports = SudoModeController =

	sudoModePrompt: (req, res, next) ->
		userId = AuthenticationController.getLoggedInUserId(req)
		logger.log {userId}, "[SudoMode] rendering sudo mode password page"
		SudoModeHandler.isSudoModeActive userId, (err, isActive) ->
			if err?
				logger.err {err, userId}, "[SudoMode] error checking if sudo mode is active"
				return next(err)
			if isActive
				logger.log {userId}, "[SudoMode] sudo mode already active, redirecting"
				return res.redirect('/project')
			res.render 'sudo_mode/sudo_mode_prompt', title: 'confirm_your_password'

	submitPassword: (req, res, next) ->
		userId = AuthenticationController.getLoggedInUserId(req)
		redir = AuthenticationController._getRedirectFromSession(req) || "/project"
		password = req.body.password
		if !password
			logger.log {userId}, "[SudoMode] no password supplied, failed authentication"
			return next(new Error('no password supplied'))
		logger.log {userId, redir}, "[SudoMode] checking user password"
		UserGetter.getUser ObjectId(userId), {email: 1}, (err, userRecord) ->
			if err?
				logger.err {err, userId}, "[SudoMode] error getting user"
				return next(err)
			AuthenticationManager.authenticate email: userRecord.email, password, (err, user) ->
				if err?
					logger.err {err, userId}, "[SudoMode] error authenticating user"
					return next(err)
				if user?
					logger.log {userId}, "[SudoMode] authenticated user, activating sudo mode"
					SudoModeHandler.activateSudoMode userId, (err) ->
						if err?
							logger.err {err, userId}, "[SudoMode] error activating sudo mode"
							return next(err)
						return res.json {
							redir: redir
						}
				else
					logger.log {userId}, "[SudoMode] authentication failed for user"
					return res.json {
						message: {
							text: req.i18n.translate("invalid_password"),
							type: 'error'
						}
					}

