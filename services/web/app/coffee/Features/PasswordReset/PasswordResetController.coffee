PasswordResetHandler = require("./PasswordResetHandler")
RateLimiter = require("../../infrastructure/RateLimiter")
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
		res.render "user/setPassword", 
			title:"set_password"
			passwordResetToken:req.query.passwordResetToken

	setNewUserPassword: (req, res)->
		{passwordResetToken, password} = req.body
		if !password? or password.length == 0 or !passwordResetToken? or passwordResetToken.length == 0
			return res.sendStatus 400
		PasswordResetHandler.setNewUserPassword passwordResetToken?.trim(), password?.trim(), (err, found) ->
			return next(err) if err?
			if found
				res.sendStatus 200
			else
				res.send 404, {message: req.i18n.translate("password_reset_token_expired")}