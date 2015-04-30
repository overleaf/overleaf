PasswordResetController = require("./PasswordResetController")
AuthenticationController = require('../Authentication/AuthenticationController')

module.exports =
	apply: (app) ->

		app.get  '/user/password/reset', PasswordResetController.renderRequestResetForm
		app.post  '/user/password/reset', PasswordResetController.requestReset
		AuthenticationController.addEndpointToLoginWhitelist '/user/password/reset'
		
		app.get '/user/password/set', PasswordResetController.renderSetPasswordForm
		app.post '/user/password/set', PasswordResetController.setNewUserPassword
		AuthenticationController.addEndpointToLoginWhitelist '/user/password/set'

