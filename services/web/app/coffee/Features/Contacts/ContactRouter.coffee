AuthenticationController = require('../Authentication/AuthenticationController')
ContactController = require "./ContactController"

module.exports =
	apply: (webRouter, apiRouter) ->
		webRouter.get '/user/contacts',
			AuthenticationController.requireLogin(),
			ContactController.getContacts

