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

app = express()

app.use Metrics.http.monitor(logger)

app.get  '/project/:project_id/doc', HttpController.getAllDocs
app.get  '/project/:project_id/doc/:doc_id', HttpController.getDoc
app.get  '/project/:project_id/doc/:doc_id/raw', HttpController.getRawDoc
app.post '/project/:project_id/doc/:doc_id', bodyParser.json(limit: "2mb"), HttpController.updateDoc
app.del  '/project/:project_id/doc/:doc_id', HttpController.deleteDoc

if Settings.filestore.backend == "s3"
	app.get  '/project/:project_id/archive', HttpController.archiveAllDocs

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
