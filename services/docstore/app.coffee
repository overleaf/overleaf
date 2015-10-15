Settings   = require "settings-sharelatex"
logger     = require "logger-sharelatex"
express    = require "express"
bodyParser = require "body-parser"
Errors     = require "./app/js/Errors"
HttpController = require "./app/js/HttpController"
Metrics    = require "metrics-sharelatex"
Path       = require "path"

Metrics.initialize("docstore")
logger.initialize("docstore")
Metrics.mongodb.monitor(Path.resolve(__dirname + "/node_modules/mongojs/node_modules/mongodb"), logger)
Metrics.event_loop?.monitor(logger)

app = express()

app.use Metrics.http.monitor(logger)

app.get  '/project/:project_id/doc', HttpController.getAllDocs
app.get  '/project/:project_id/doc/:doc_id', HttpController.getDoc
app.get  '/project/:project_id/doc/:doc_id/raw', HttpController.getRawDoc
app.post '/project/:project_id/doc/:doc_id', bodyParser.json(limit: "2mb"), HttpController.updateDoc
app.del  '/project/:project_id/doc/:doc_id', HttpController.deleteDoc

app.post  '/project/:project_id/archive', HttpController.archiveAllDocs
app.post  '/project/:project_id/unarchive', HttpController.unArchiveAllDocs


ObjectId = require("mongojs").ObjectId
request = require("request")
async = require("async")
_ = require("underscore")
crypto = require("crypto")

app.get "/health_check", (req, res)->
	doc_id = ObjectId()
	project_id = ObjectId()
	url = "http://localhost:#{port}/project/#{project_id}/doc/#{doc_id}"
	lines = ["smoke test - delete me", "#{crypto.randomBytes(32).toString("hex")}"]
	logger.log lines:lines, url:url, doc_id:doc_id, project_id:project_id, "running health check"
	jobs = [
		(cb)->
			opts = 
				url:url
				json: {lines: lines}
			request.post(opts, cb)
		(cb)->
			request.get {url:url, json:true}, (err, res, body)->
				if res.statusCode != 200
					cb("status code not 200, its #{res.statusCode}")
				else if _.isEqual(body.lines, lines) and body._id == doc_id.toString()
					cb()
				else
					cb("lines not equal ")
		(cb)->
			request.del url, cb
	]
	async.series jobs, (err)->
		if err?
			logger.err err:err, "error running health check"
			res.send 500
		else
			res.send()





app.get '/status', (req, res)->
	res.send('docstore is alive')

app.use (error, req, res, next) ->
	logger.error err: error, "request errored"
	if error instanceof Errors.NotFoundError
		res.send 404
	else
		res.send(500, "Oops, something went wrong")

port = Settings.internal.docstore.port
host = Settings.internal.docstore.host
app.listen port, host, (error) ->
	throw error if error?
	logger.info "Docstore starting up, listening on #{host}:#{port}"
