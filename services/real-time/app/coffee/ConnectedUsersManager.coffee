async = require("async")
Settings = require('settings-sharelatex')
logger = require("logger-sharelatex")
redis = require("redis-sharelatex")
rclient = redis.createClient(Settings.redis.realtime)
Keys = Settings.redis.realtime.key_schema

ONE_HOUR_IN_S = 60 * 60
ONE_DAY_IN_S = ONE_HOUR_IN_S * 24
FOUR_DAYS_IN_S = ONE_DAY_IN_S * 4

USER_TIMEOUT_IN_S = ONE_HOUR_IN_S / 4
REFRESH_TIMEOUT_IN_S = 10  # only show clients which have responded to a refresh request in the last 10 seconds

module.exports =
	# Use the same method for when a user connects, and when a user sends a cursor
	# update. This way we don't care if the connected_user key has expired when
	# we receive a cursor update. 
	updateUserPosition: (project_id, client_id, user, cursorData, callback = (err)->)->
		logger.log project_id:project_id, client_id:client_id, "marking user as joined or connected"

		multi = rclient.multi()
		
		multi.sadd   Keys.clientsInProject({project_id}), client_id
		multi.expire Keys.clientsInProject({project_id}), FOUR_DAYS_IN_S
		
		multi.hset Keys.connectedUser({project_id, client_id}), "last_updated_at", Date.now()
		multi.hset Keys.connectedUser({project_id, client_id}), "user_id", user._id
		multi.hset Keys.connectedUser({project_id, client_id}), "first_name", user.first_name or ""
		multi.hset Keys.connectedUser({project_id, client_id}), "last_name", user.last_name or ""
		multi.hset Keys.connectedUser({project_id, client_id}), "email", user.email or ""
		
		if cursorData?
			multi.hset Keys.connectedUser({project_id, client_id}), "cursorData", JSON.stringify(cursorData)
		multi.expire Keys.connectedUser({project_id, client_id}), USER_TIMEOUT_IN_S
		
		multi.exec (err)->
			if err?
				logger.err err:err, project_id:project_id, client_id:client_id, "problem marking user as connected"
			callback(err)

	refreshClient: (project_id, client_id, callback = (err) ->) ->
		logger.log project_id:project_id, client_id:client_id, "refreshing connected client"
		multi = rclient.multi()
		multi.hset Keys.connectedUser({project_id, client_id}), "last_updated_at", Date.now()
		multi.expire Keys.connectedUser({project_id, client_id}), USER_TIMEOUT_IN_S
		multi.exec (err)->
			if err?
				logger.err err:err, project_id:project_id, client_id:client_id, "problem refreshing connected client"
			callback(err)

	markUserAsDisconnected: (project_id, client_id, callback)->
		logger.log project_id:project_id, client_id:client_id, "marking user as disconnected"
		multi = rclient.multi()
		multi.srem Keys.clientsInProject({project_id}), client_id
		multi.expire Keys.clientsInProject({project_id}), FOUR_DAYS_IN_S
		multi.del Keys.connectedUser({project_id, client_id})
		multi.exec callback


	_getConnectedUser: (project_id, client_id, callback)->
		rclient.hgetall Keys.connectedUser({project_id, client_id}), (err, result)->
			if !result? or Object.keys(result).length == 0 or !result.user_id
				result =
					connected : false
					client_id:client_id
			else
				result.connected = true
				result.client_id = client_id
				result.client_age = (Date.now() - parseInt(result.last_updated_at,10)) / 1000
				if result.cursorData?
					try
						result.cursorData = JSON.parse(result.cursorData)
					catch e
						logger.error {err: e, project_id, client_id, cursorData: result.cursorData}, "error parsing cursorData JSON" 
						return callback e
			callback err, result

	getConnectedUsers: (project_id, callback)->
		self = @
		rclient.smembers Keys.clientsInProject({project_id}), (err, results)->
			return callback(err) if err?
			jobs = results.map (client_id)->
				(cb)->
					self._getConnectedUser(project_id, client_id, cb)
			async.series jobs, (err, users = [])->
				return callback(err) if err?
				users = users.filter (user) ->
					user?.connected && user?.client_age < REFRESH_TIMEOUT_IN_S
				callback null, users

