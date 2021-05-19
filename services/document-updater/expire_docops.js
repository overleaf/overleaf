Settings = require "settings-sharelatex"
rclient = require("@overleaf/redis-wrapper").createClient(Settings.redis.documentupdater)
keys = Settings.redis.documentupdater.key_schema
async = require "async"
RedisManager = require "./app/js/RedisManager"

getKeysFromNode = (node, pattern, callback) ->
	cursor = 0  # redis iterator
	keySet = {} # use hash to avoid duplicate results
	# scan over all keys looking for pattern
	doIteration = (cb) ->
		node.scan cursor, "MATCH", pattern, "COUNT", 1000, (error, reply) ->
			return callback(error) if error?
			[cursor, keys] = reply
			console.log "SCAN", keys.length
			for key in keys
				keySet[key] = true
			if cursor == '0'  # note redis returns string result not numeric
				return callback(null, Object.keys(keySet))
			else
				doIteration()
	doIteration()

getKeys = (pattern, callback) ->
	nodes = rclient.nodes?('master') || [ rclient ];
	console.log "GOT NODES", nodes.length
	doKeyLookupForNode = (node, cb) ->
		getKeysFromNode node, pattern, cb
	async.concatSeries nodes, doKeyLookupForNode, callback

TTL = 60 * 60 # 1 hour
expireDocOps = (callback) ->
	getKeys keys.docOps(doc_id: "*"), (error, keys) ->
		async.mapSeries keys,
			(key, cb) ->
				console.log "EXPIRE #{key} #{RedisManager.DOC_OPS_TTL}"
				rclient.expire key, RedisManager.DOC_OPS_TTL, cb
			callback

setTimeout () -> #  Give redis a chance to connect
	expireDocOps (error) ->
		throw error if error?
		process.exit()
, 1000
