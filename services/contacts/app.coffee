Metrics    = require "metrics-sharelatex"
Metrics.initialize("contacts")

Settings   = require "settings-sharelatex"
logger     = require "logger-sharelatex"
express    = require "express"
bodyParser = require "body-parser"
Errors     = require "./app/js/Errors"
HttpController = require "./app/js/HttpController"

Path       = require "path"


logger.initialize("contacts")
Metrics.event_loop?.monitor(logger)

app = express()

app.use Metrics.http.monitor(logger)

Metrics.injectMetricsRoute(app)

app.get  '/user/:user_id/contacts', HttpController.getContacts
app.post '/user/:user_id/contacts', bodyParser.json(limit: "2mb"), HttpController.addContact

app.get '/status', (req, res)->
	res.send('contacts is alive')

app.use (error, req, res, next) ->
	logger.error err: error, "request errored"
	if error instanceof Errors.NotFoundError
		res.send 404
	else
		res.send(500, "Oops, something went wrong")

port = Settings.internal.contacts.port
host = Settings.internal.contacts.host


if !module.parent # Called directly
	app.listen port, host, (error) ->
		throw error if error?
		logger.info "contacts starting up, listening on #{host}:#{port}"

module.exports = app
