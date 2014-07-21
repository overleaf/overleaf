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

USER_TIMEOUT_IN_S = ONE_HOUR_IN_S / 4

buildProjectSetKey = (project_id)-> return "clients_in_project:#{project_id}"
buildUserKey = (project_id, client_id)-> return "connected_user:#{project_id}:#{client_id}"


module.exports =

	# Use the same method for when a user connects, and when a user sends a cursor
	# update. This way we don't care if the connected_user key has expired when
	# we receive a cursor update. 
	updateUserPosition: (project_id, client_id, user, cursorData, callback = (err)->)->
		logger.log project_id:project_id, client_id:client_id, "marking user as connected"

		multi = rclient.multi()
		
		multi.sadd   buildProjectSetKey(project_id), client_id
		multi.expire buildProjectSetKey(project_id), FOUR_DAYS_IN_S
		
		multi.hset buildUserKey(project_id, client_id), "last_updated_at", Date.now()
		multi.hset buildUserKey(project_id, client_id), "user_id", user._id
		multi.hset buildUserKey(project_id, client_id), "first_name", user.first_name
		multi.hset buildUserKey(project_id, client_id), "last_name", user.last_name
		multi.hset buildUserKey(project_id, client_id), "email", user.email
		
		if cursorData?
			multi.hset buildUserKey(project_id, client_id), "cursorData", JSON.stringify(cursorData)
		multi.expire buildUserKey(project_id, client_id), USER_TIMEOUT_IN_S
		
		multi.exec (err)->
			if err?
				logger.err err:err, project_id:project_id, client_id:client_id, "problem marking user as connected"
			callback(err)

	markUserAsDisconnected: (project_id, client_id, callback)->
		logger.log project_id:project_id, client_id:client_id, "marking user as disconnected"
		multi = rclient.multi()
		multi.srem buildProjectSetKey(project_id), client_id
		multi.expire buildProjectSetKey(project_id), FOUR_DAYS_IN_S
		multi.del buildUserKey(project_id, client_id)
		multi.exec callback


	_getConnectedUser: (project_id, client_id, callback)->
		rclient.hgetall buildUserKey(project_id, client_id), (err, result)->
			if !result?
				result =
					connected : false
					client_id:client_id
			else
				result.connected = true
				result.client_id = client_id
				if result.cursorData?
					result.cursorData = JSON.parse(result.cursorData)
			callback err, result

	getConnectedUsers: (project_id, callback)->
		self = @
		rclient.smembers buildProjectSetKey(project_id), (err, results)->
			jobs = results.map (client_id)->
				(cb)->
					self._getConnectedUser(project_id, client_id, cb)
			async.series jobs, (err, users)->
				users = _.filter users, (user)->
					user.connected
				callback err, users

