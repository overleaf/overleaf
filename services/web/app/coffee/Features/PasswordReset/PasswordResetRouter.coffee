module.exports =
	apply: (app) ->

		app.get  '/user/password/reset', PasswordResetController.renderRequestReset
		app.post  '/user/password/reset', ProjectDownloadsController.requestRest
		
		app.get '/user/password/set', PasswordResetController.renderSetPassword
		app.post '/user/password/set', PasswordResetController.setNewUserPassword

