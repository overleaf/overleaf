PasswordResetController = require("./PasswordResetController")
AuthenticationController = require('../Authentication/AuthenticationController')

module.exports =
	apply: (webRouter, apiRouter) ->

		webRouter.get  '/user/password/reset', PasswordResetController.renderRequestResetForm
		webRouter.post  '/user/password/reset', PasswordResetController.requestReset
		AuthenticationController.addEndpointToLoginWhitelist '/user/password/reset'
		
		webRouter.get '/user/password/set', PasswordResetController.renderSetPasswordForm
		webRouter.post '/user/password/set', PasswordResetController.setNewUserPassword
		AuthenticationController.addEndpointToLoginWhitelist '/user/password/set'

