Settings = require "settings-sharelatex"
logger = require "logger-sharelatex"
TrackChangesLogger = logger.initialize("track-changes").logger
async = require "async"
fs = require "fs"
request = require "request"
cli = require "cli"

mongojs = require "mongojs"
bson = require "bson"
db = mongojs(Settings.mongo.url, ["docs"])
ObjectId = mongojs.ObjectId

options = cli.parse({
	port: ['p', 'port number for track changes', 'number'],
	force: ['f', 'actually make the fix']
});

if cli.args.length < 1
	console.log "fixdangling -p PORT file_of_doc_ids"
	process.exit()

file = cli.args.pop()
doc_ids = fs.readFileSync(file).toString().trim().split("\n")

missing = 0
errored = 0
success = 0

fixDangling = (doc_id, callback) ->
	# look up project id from doc id
	db.docs.find {_id:ObjectId(doc_id)}, {project_id:1}, (err, result) ->
		#console.log "doc_id", doc_id, "err", err, "result", result
		if err?
			errored++
			return callback()
		if !result? or result.length == 0
			missing++
			return callback()
		project_id = result[0].project_id
		console.log "found project_id", project_id, "for doc_id", doc_id
		url = "http://localhost:#{options.port}/project/#{project_id}/doc/#{doc_id}/flush"
		if options.force
			request.post url, (err, response, body) ->
				if err? then errored++ else success++
				callback()
		else
			console.log "URL:", url
			success++
			callback()

async.eachSeries doc_ids, fixDangling, (err) ->
	console.log "final result", err, "missing", missing, "errored", errored, "success", success
	db.close()
