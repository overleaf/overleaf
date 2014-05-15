PasswordResetHandler = require("./PasswordResetHandler")

module.exports =

	renderRequestResetForm: (req, res)->
		res.render "user/passwordReset", 
			title:"Reset Password"

	requestReset: (req, res)->
		email = req.body.email.trim()
		PasswordResetHandler.generateAndEmailResetToken email, (err)->
			if err?
				res.send 500
			else
				res.send 200


	renderSetPasswordForm: (req, res)->
		res.render "user/setPassword", 
			title:"Set Password"


	setNewUserPassword: (req, res)->
		{token, password} = req.body
		if !password? or password.length < 4 or !token? or token.length == 0
			return res.send 500
		PasswordResetHandler.setNewUserPassword token?.trim(), password?.trim(), (err)->
			if err?
				res.send 500
			else
				res.send 200