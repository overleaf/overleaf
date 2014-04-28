Settings = require('settings-sharelatex')
logger = require('logger-sharelatex')
logger.initialize("docstore")

express = require('express')
HttpController = require "./app/js/HttpController"
Errors = require "./app/js/Errors"

app = express()

app.get '/project/:project_id/doc/:doc_id', HttpController.getDoc

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
	logger.log("docstore listening on #{host}:#{port}")
