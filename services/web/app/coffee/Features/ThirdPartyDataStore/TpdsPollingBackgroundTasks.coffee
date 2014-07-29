User = require('../../models/User').User
settings = require('settings-sharelatex')
request = require "request"
logger = require('logger-sharelatex')
redis = require('redis')
rclient = redis.createClient(settings.redis.web.port, settings.redis.web.host)
rclient.auth(settings.redis.web.password)

LAST_TIME_POLL_HAPPEND_KEY = "LAST_TIME_POLL_HAPPEND_KEY"

self = module.exports =

	pollUsersWithDropbox: (callback)->
		self._getUserIdsWithDropbox (err, user_ids)=>
			logger.log user_ids:user_ids, userCount:user_ids.length, "telling tpds to poll users with dropbox"
			self._markPollHappened()
			self._sendToTpds user_ids, callback

	_sendToTpds : (user_ids, callback)->
		if user_ids.length > 0
			request.post {uri:"#{settings.apis.thirdPartyDataStore.url}/user/poll", json:{user_ids:user_ids}}, callback
		else if callback?
			callback()

	_getUserIdsWithDropbox: (callback)->
		User.find {"dropbox.access_token.oauth_token_secret":{"$exists":true}, "features.dropbox":true}, "_id", (err, users)->
			ids = users.map (user)->
				return user._id+""
			callback err, ids

	_markPollHappened: (callback)->
		rclient.set LAST_TIME_POLL_HAPPEND_KEY, new Date().getTime(), callback

	getLastTimePollHappned: (callback = (err, lastTimePollHappened)->)->
		rclient.get LAST_TIME_POLL_HAPPEND_KEY, (err, time)->
			logger.log lastTimePollHappened:time, "got last time a poll happend to dropbox"
			callback(err, time)

