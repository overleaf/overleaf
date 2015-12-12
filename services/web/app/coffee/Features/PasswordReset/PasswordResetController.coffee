PasswordResetHandler = require("./PasswordResetHandler")
RateLimiter = require("../../infrastructure/RateLimiter")
AuthenticationController = require("../Authentication/AuthenticationController")
UserGetter = require("../User/UserGetter")
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
				return res.send 500, { message: req.i18n.translate("rate_limit_hit_wait")}
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
		if !password? or password.length == 0 or !passwordResetToken? or passwordResetToken.length == 0
			return res.sendStatus 400
		delete req.session.resetToken
		PasswordResetHandler.setNewUserPassword passwordResetToken?.trim(), password?.trim(), (err, found, user_id) ->
			return next(err) if err?
			if found
				if req.body.login_after
					UserGetter.getUser user_id, {email: 1}, (err, user) ->
						return next(err) if err?
						AuthenticationController.doLogin {email:user.email, password: password}, req, res, next
				else
					res.sendStatus 200
			else
				res.sendStatus 404
