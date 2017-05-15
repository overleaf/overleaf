logger = require 'logger-sharelatex'
SudoModeHandler = require './SudoModeHandler'
AuthenticationController = require '../Authentication/AuthenticationController'


module.exports = SudoModeMiddlewear =

	protectPage: (req, res, next) ->
		if req.externalAuthenticationSystemUsed()
			logger.log {userId}, "[SudoMode] using external auth, skipping sudo-mode check"
			return next()
		userId = AuthenticationController.getLoggedInUserId(req)
		logger.log {userId}, "[SudoMode] protecting endpoint, checking if sudo mode is active"
		SudoModeHandler.isSudoModeActive userId, (err, isActive) ->
			if err?
				logger.err {err, userId}, "[SudoMode] error checking if sudo mode is active"
				return next(err)
			if isActive
				logger.log {userId}, "[SudoMode] sudo mode active, continuing"
				return next()
			else
				logger.log {userId}, "[SudoMode] sudo mode not active, redirecting"
				AuthenticationController._setRedirectInSession(req)
				return res.redirect('/confirm-password')
