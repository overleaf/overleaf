logger = require("logger-sharelatex")
DropboxWebhookHandler = require("./DropboxWebhookHandler")

module.exports = DropboxWebhookController =
	verify: (req, res, next = (error) ->) ->
		res.send(req.query.challenge)
		
	webhook: (req, res, next = (error) ->) ->
		dropbox_uids = req.body?.delta?.users
		logger.log dropbox_uids: dropbox_uids, "received webhook request from Dropbox"
		if !dropbox_uids?
			return res.send(400) # Bad Request
		DropboxWebhookHandler.pollDropboxUids dropbox_uids, (error) ->
			return next(error) if error?
			res.send(200)