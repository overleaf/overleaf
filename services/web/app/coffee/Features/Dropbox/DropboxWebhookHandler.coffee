logger = require("logger-sharelatex")
settings = require("settings-sharelatex")
async = require "async"
User = require("../../models/User").User
TpdsUpdateSender = require "../ThirdPartyDataStore/TpdsUpdateSender"

redis = require("redis-sharelatex")
rclient = redis.createClient(settings.redis.web)

module.exports = DropboxWebhookHandler =
	pollDropboxUids: (dropbox_uids, callback = (error) ->) ->
		jobs = []
		for uid in dropbox_uids
			do (uid) ->
				jobs.push (callback) ->
					DropboxWebhookHandler.pollDropboxUid uid, callback
		async.series jobs, callback
		
	pollDropboxUid: (dropbox_uid, callback = (error) ->) ->
		DropboxWebhookHandler._delayAndBatchPoll dropbox_uid, (error, shouldPoll) ->
			return callback(error) if error?
			return callback() if !shouldPoll
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
		
	POLL_DELAY_IN_MS: 5000 # 5 seconds
	_delayAndBatchPoll: (dropbox_uid, callback = (error, shouldPoll) ->) ->
		rclient.set(
			"dropbox-poll-lock:#{dropbox_uid}", "LOCK",
			"PX", DropboxWebhookHandler.POLL_DELAY_IN_MS,
			"NX",
		(error, gotLock) ->
			return callback(error) if error?
			if gotLock
				setTimeout () ->
					callback(null, true)
				, DropboxWebhookHandler.POLL_DELAY_IN_MS
			else
				callback(null, false)
		)