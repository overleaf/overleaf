PasswordResetHandler = require("./PasswordResetHandler")
RateLimiter = require("../../infrastructure/RateLimiter")
AuthenticationController = require("../Authentication/AuthenticationController")
AuthenticationManager = require("../Authentication/AuthenticationManager")
UserGetter = require("../User/UserGetter")
UserSessionsManager = require("../User/UserSessionsManager")
logger = require "logger-sharelatex"

module.exports =

	renderRequestResetForm: (req, res)->
		logger.log "rendering request reset form"
		res.render "user/passwordReset",
			title:"reset_password"

	requestReset: (req, res)->
		email = req.body.email.trim().toLowerCase()
		opts =
			endpointName: "password_reset_rate_limit"
			timeInterval: 60
			subjectName: req.ip
			throttle: 6
		RateLimiter.addCount opts, (err, canContinue)->
			if !canContinue
				return res.send 429, { message: req.i18n.translate("rate_limit_hit_wait")}
			PasswordResetHandler.generateAndEmailResetToken email, (err, exists)->
				if err?
					res.send 500, {message:err?.message}
				else if exists
					res.sendStatus 200
				else
					res.send 404, {message: req.i18n.translate("cant_find_email")}

	renderSetPasswordForm: (req, res)->
		if req.query.passwordResetToken?
			req.session.resetToken = req.query.passwordResetToken
			return res.redirect('/user/password/set')
		if !req.session.resetToken?
			return res.redirect('/user/password/reset')
		res.render "user/setPassword",
			title:"set_password"
			passwordResetToken: req.session.resetToken

	setNewUserPassword: (req, res, next)->
		{passwordResetToken, password} = req.body
		if !password? or password.length == 0 or !passwordResetToken? or passwordResetToken.length == 0 or AuthenticationManager.validatePassword(password?.trim())?
			return res.sendStatus 400
		delete req.session.resetToken
		PasswordResetHandler.setNewUserPassword passwordResetToken?.trim(), password?.trim(), (err, found, user_id) ->
			if err and err.name and err.name == "NotFoundError"
				res.status(404).send("NotFoundError")
			else if err and err.name and err.name == "NotInV2Error"
				res.status(403).send("NotInV2Error")
			else if err and err.name and err.name == "SLInV2Error"
				res.status(403).send("SLInV2Error")
			else if err and err.statusCode and err.statusCode == 500
				res.status(500)
			else if err and !err.statusCode
				res.status(500)
			else if found
				return res.sendStatus 200 if !user_id? # will not exist for v1-only users
				UserSessionsManager.revokeAllUserSessions {_id: user_id}, [], (err) ->
					return next(err) if err?
					if req.body.login_after
						UserGetter.getUser user_id, {email: 1}, (err, user) ->
							return next(err) if err?
							AuthenticationController.afterLoginSessionSetup req, user, (err) ->
								if err?
									logger.err {err, email: user.email}, "Error setting up session after setting password"
									return next(err)
								res.json {redir: AuthenticationController._getRedirectFromSession(req) || "/project"}
					else
						res.sendStatus 200
			else
				res.sendStatus 404
