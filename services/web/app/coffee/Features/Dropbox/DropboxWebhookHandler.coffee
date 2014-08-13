logger = require("logger-sharelatex")
async = require "async"
User = require("../../models/User").User
TpdsUpdateSender = require "../ThirdPartyDataStore/TpdsUpdateSender"

module.exports = DropboxWebhookHandler =
	pollDropboxUids: (dropbox_uids, callback = (error) ->) ->
		jobs = []
		for uid in dropbox_uids
			do (uid) ->
				jobs.push (callback) ->
					DropboxWebhookHandler.pollDropboxUid uid, callback
		async.series jobs, callback
		
	pollDropboxUid: (dropbox_uid, callback = (error) ->) ->
		User.find {
			"dropbox.access_token.uid": dropbox_uid.toString()
			"features.dropbox": true
		}, (error, users = []) ->
			return callback(error) if error?
			user = users[0]
			if !user?
				logger.log dropbox_uid: dropbox_uid, "no sharelatex user found"
				return callback()
			TpdsUpdateSender.pollDropboxForUser user._id, callback