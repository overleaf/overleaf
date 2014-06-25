PasswordResetHandler = require("./PasswordResetHandler")
RateLimiter = require("../../infrastructure/RateLimiter")


module.exports =

	renderRequestResetForm: (req, res)->
		res.render "user/passwordReset", 
			title:"Reset Password"

	requestReset: (req, res)->
		email = req.body.email.trim().toLowerCase()
		opts = 
			endpointName: "password_reset_rate_limit"
			timeInterval: 60
			subjectName: req.ip
			throttle: 6
		RateLimiter.addCount opts, (err, canCompile)->
			if !canCompile
				return res.send 500, { message: "Rate limit hit. Please wait a while before retrying" }
			PasswordResetHandler.generateAndEmailResetToken email, (err)->
				if err?
					res.send 500, {message:err?.message}
				else
					res.send 200

	renderSetPasswordForm: (req, res)->
		res.render "user/setPassword", 
			title:"Set Password"
			passwordResetToken:req.query.passwordResetToken

	setNewUserPassword: (req, res)->
		{passwordResetToken, password} = req.body
		if !password? or password.length == 0 or !passwordResetToken? or passwordResetToken.length == 0
			return res.send 500
		PasswordResetHandler.setNewUserPassword passwordResetToken?.trim(), password?.trim(), (err)->
			if err?
				res.send 500
			else
				res.send 200