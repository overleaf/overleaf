Metrics    = require "metrics-sharelatex"
Metrics.initialize("docstore")
Settings   = require "settings-sharelatex"
logger     = require "logger-sharelatex"
express    = require "express"
bodyParser = require "body-parser"
Errors     = require "./app/js/Errors"
HttpController = require "./app/js/HttpController"
Path       = require "path"


logger.initialize("docstore")
Metrics.event_loop?.monitor(logger)

app = express()

app.use Metrics.http.monitor(logger)

Metrics.injectMetricsRoute(app)

app.param 'project_id', (req, res, next, project_id) ->
	if project_id?.match /^[0-9a-f]{24}$/
		next()
	else
		next new Error("invalid project id")

app.param 'doc_id', (req, res, next, doc_id) ->
	if doc_id?.match /^[0-9a-f]{24}$/
		next()
	else
		next new Error("invalid doc id")

Metrics.injectMetricsRoute(app)

app.get  '/project/:project_id/doc', HttpController.getAllDocs
app.get  '/project/:project_id/ranges', HttpController.getAllRanges
app.get  '/project/:project_id/doc/:doc_id', HttpController.getDoc
app.get  '/project/:project_id/doc/:doc_id/raw', HttpController.getRawDoc
# Add 64kb overhead for the JSON encoding
app.post '/project/:project_id/doc/:doc_id', bodyParser.json(limit: Settings.max_doc_length + 64 * 1024), HttpController.updateDoc
app.del  '/project/:project_id/doc/:doc_id', HttpController.deleteDoc

app.post  '/project/:project_id/archive', HttpController.archiveAllDocs
app.post  '/project/:project_id/unarchive', HttpController.unArchiveAllDocs

app.get "/health_check",  HttpController.healthCheck

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

if !module.parent # Called directly
	app.listen port, host, (error) ->
		throw error if error?
		logger.info "Docstore starting up, listening on #{host}:#{port}"

module.exports = app
