Settings = require('settings-sharelatex')
rclient = require("redis-sharelatex").createClient(Settings.redis.web)
Keys = Settings.redis.web.key_schema
logger = require('logger-sharelatex')

module.exports = WebRedisManager =
	getPendingUpdatesForDoc : (doc_id, callback)->
		multi = rclient.multi()
		multi.lrange Keys.pendingUpdates({doc_id}), 0 , -1
		multi.del Keys.pendingUpdates({doc_id})
		multi.exec (error, replys) ->
			return callback(error) if error?
			jsonUpdates = replys[0]
			updates = []
			for jsonUpdate in jsonUpdates
				try
					update = JSON.parse jsonUpdate
				catch e
					return callback e
				updates.push update
			callback error, updates

	getUpdatesLength: (doc_id, callback)->
		rclient.llen Keys.pendingUpdates({doc_id}), callback

	sendData: (data) ->
		rclient.publish "applied-ops", JSON.stringify(data)
