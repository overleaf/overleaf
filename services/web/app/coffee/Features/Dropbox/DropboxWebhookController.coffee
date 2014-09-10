logger = require("logger-sharelatex")
DropboxWebhookHandler = require("./DropboxWebhookHandler")

module.exports = DropboxWebhookController =
	verify: (req, res, next = (error) ->) ->
		res.send(req.query.challenge)
		req.session.destroy()
		
	webhook: (req, res, next = (error) ->) ->
		dropbox_uids = req.body?.delta?.users
		logger.log dropbox_uids: dropbox_uids, "received webhook request from Dropbox"
		if !dropbox_uids?
			return res.send(400) # Bad Request
			
		# Do this in the background so as not to keep Dropbox waiting
		DropboxWebhookHandler.pollDropboxUids dropbox_uids, (error) ->
			if error?
				logger.error err: error, dropbox_uids: dropbox_uids, "error in webhook"
		
		res.send(200)
		req.session.destroy()
