Settings = require('settings-sharelatex')
rclient = require("redis-sharelatex").createClient(Settings.redis.documentupdater)
pubsubClient = require("redis-sharelatex").createClient(Settings.redis.pubsub)
Keys = Settings.redis.documentupdater.key_schema
logger = require('logger-sharelatex')
os = require "os"
crypto = require "crypto"
metrics = require('./Metrics')

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
			for jsonUpdate in jsonUpdates
				# record metric for each update removed from queue
				metrics.summary "redis.pendingUpdates", jsonUpdate.length, {status: "pop"}
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

		blob = JSON.stringify(data)
		metrics.summary "redis.publish.applied-ops", blob.length

		# publish on separate channels for individual projects and docs when
		# configured (needs realtime to be configured for this too).
		if Settings.publishOnIndividualChannels
			pubsubClient.publish "applied-ops:#{data.doc_id}", blob
		else
			pubsubClient.publish "applied-ops", blob
