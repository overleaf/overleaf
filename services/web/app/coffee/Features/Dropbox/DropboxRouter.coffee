DropboxUserController = require './DropboxUserController'
DropboxWebhookController = require './DropboxWebhookController'

module.exports =
	apply: (app) ->
		app.get  '/dropbox/beginAuth', DropboxUserController.redirectUserToDropboxAuth
		app.get  '/dropbox/completeRegistration', DropboxUserController.completeDropboxRegistration
		app.get  '/dropbox/unlink', DropboxUserController.unlinkDropbox
		
		app.get  '/dropbox/webhook', DropboxWebhookController.verify
		app.post '/dropbox/webhook', DropboxWebhookController.webhook
		app.ignoreCsrf('post', '/dropbox/webhook')



