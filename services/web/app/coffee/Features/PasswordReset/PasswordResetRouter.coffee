PasswordResetController = require("./PasswordResetController")

module.exports =
	apply: (app) ->

		app.get  '/user/password/reset', PasswordResetController.renderRequestResetForm
		app.post  '/user/password/reset', PasswordResetController.requestReset
		
		app.get '/user/password/set', PasswordResetController.renderSetPasswordForm
		app.post '/user/password/set', PasswordResetController.setNewUserPassword

