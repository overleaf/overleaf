request = require "request"
rclient = require("redis").createClient()
async = require "async"
{ObjectId} = require("./app/js/mongojs")

NO_OF_DOCS = 100
NO_OF_UPDATES = 200

user_id = ObjectId().toString()

updates = for i in [1..NO_OF_UPDATES]
	{
		op: { i: "a", p: 0 }
		v: i
		meta: ts: new Date(), user_id: user_id
	}
jsonUpdates = (JSON.stringify(u) for u in updates)

doc_ids = (ObjectId().toString() for i in [1..NO_OF_DOCS])

populateRedis = (callback = (error) ->) ->
	console.log "Populating Redis queues..."

	jobs = []
	for doc_id in doc_ids
		do (doc_id) ->
			jobs.push (callback) ->
				rclient.rpush "UncompressedHistoryOps:#{doc_id}", jsonUpdates..., callback
	async.series jobs, (error) ->
		return callback(error) if error?
		console.log "Done."
		callback()

flushDocs = (callback = (error) ->) ->
	console.log "Flushing docs..."
	inProgress = 0
	jobs = []
	for doc_id in doc_ids
		do (doc_id) ->
			jobs.push (callback) ->
				inProgress = inProgress + 1
				request.post "http://localhost:3014/doc/#{doc_id}/flush", (error) ->
					inProgress = inProgress - 1
					console.log Date.now(), "In progress: #{inProgress}"
					callback(error)
	async.parallel jobs, (error) ->
		return callback(error) if error?
		console.log "Done."
		callback()

populateRedis (error) ->
	throw error if error?
	flushDocs (error) ->
		throw error if error?
		process.exit(0)

