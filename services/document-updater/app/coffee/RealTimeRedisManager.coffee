Settings = require('settings-sharelatex')
rclient = require("redis-sharelatex").createClient(Settings.redis.realtime)
Keys = Settings.redis.realtime.key_schema
logger = require('logger-sharelatex')
os = require "os"
crypto = require "crypto"

HOST = os.hostname()
RND = crypto.randomBytes(4).toString('hex') # generate a random key for this process
COUNT = 0

MAX_OPS_PER_ITERATION = 8 # process a limited number of ops for safety

module.exports = RealTimeRedisManager =
	getPendingUpdatesForDoc : (doc_id, callback)->
		multi = rclient.multi()
		multi.lrange Keys.pendingUpdates({doc_id}), 0, (MAX_OPS_PER_ITERATION-1)
		multi.ltrim Keys.pendingUpdates({doc_id}), MAX_OPS_PER_ITERATION, -1
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
		# create a unique message id using a counter
		message_id = "doc:#{HOST}:#{RND}-#{COUNT++}"
		data?._id = message_id
		rclient.publish "applied-ops", JSON.stringify(data)
