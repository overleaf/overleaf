_ = require("underscore")
async = require("async")
Settings = require('settings-sharelatex')
logger = require("logger-sharelatex")
redis = require('redis')
rclient = redis.createClient(Settings.redis.web.port, Settings.redis.web.host)
rclient.auth(Settings.redis.web.password)


ONE_HOUR_IN_S = 60 * 60
ONE_DAY_IN_S = ONE_HOUR_IN_S * 24
FOUR_DAYS_IN_S = ONE_DAY_IN_S * 4

buildProjectSetKey = (project_id)-> return "users_in_project:#{project_id}"
buildUserKey = (project_id, user_id)-> return "connected_user:#{project_id}:#{user_id}"


module.exports =

	markUserAsConnected: (project_id, user_id, callback = (err)->)->
		logger.log project_id:project_id, user_id:user_id, "marking user as connected"
		async.series [
			(cb)->
				rclient.sadd buildProjectSetKey(project_id), user_id, cb
			(cb)->
				rclient.expire buildProjectSetKey(project_id), FOUR_DAYS_IN_S, cb
			(cb)->
				rclient.setex buildUserKey(project_id, user_id), ONE_HOUR_IN_S, new Date(), cb
		], (err)->
			if err?
				logger.err err:err, project_id:project_id, user_id:user_id, "problem marking user as connected"
			callback(err)

	markUserAsDisconnected: (project_id, user_id, callback)->
		logger.log project_id:project_id, user_id:user_id, "marking user as disconnected"
		async.series [
			(cb)->
				rclient.srem buildProjectSetKey(project_id), user_id, cb
			(cb)->
				rclient.expire buildProjectSetKey(project_id), FOUR_DAYS_IN_S, cb
			(cb)->
				rclient.del buildUserKey(project_id, user_id), cb
		], callback

	_getConnectedUser: (project_id, user_id, callback)->
		rclient.get buildUserKey(project_id, user_id), (err, result)->
			if !result?
				connected = false
			else
				connected = true

			callback err, {connected:connected, user_id:user_id}

	getConnectedUsers: (project_id, callback)->
		self = @
		rclient.smembers buildProjectSetKey(project_id), (err, results)->
			jobs = results.map (user_id)->
				(cb)->
					self._getConnectedUser(project_id, user_id, cb)
			async.series jobs, (err, users)->
				users = _.filter users, (user)->
					user.connected
				user_ids = _.map users, (user)->
					user.user_id
				callback err, user_ids


