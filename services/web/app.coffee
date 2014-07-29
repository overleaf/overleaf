Settings = require('settings-sharelatex')
logger = require 'logger-sharelatex'
logger.initialize("web-sharelatex")
logger.logger.serializers.user = require("./app/js/infrastructure/LoggerSerializers").user
logger.logger.serializers.project = require("./app/js/infrastructure/LoggerSerializers").project
metrics = require("metrics-sharelatex")
metrics.initialize("web")
Server = require("./app/js/infrastructure/Server")
BackgroundTasks = require("./app/js/infrastructure/BackgroundTasks")
Errors = require "./app/js/errors"


argv = require("optimist")
	.options("user", {alias : "u", description : "Run the server with permissions of the specified user"})
	.options("group", {alias : "g", description : "Run the server with permissions of the specified group"})
	.usage("Usage: $0")
	.argv

Server.app.use (error, req, res, next) ->
	logger.error err: error, url:req.url, method:req.method, user:req?.sesson?.user, "error passed to top level next middlewear"
	res.statusCode = error.status or 500
	if res.statusCode == 500
		res.end("Oops, something went wrong with your request, sorry. If this continues, please contact us at support@sharelatex.com")
	else
		res.end()

if Settings.catchErrors
	# fairy cleans then exits on an uncaughtError, but we don't want
	# to exit so it doesn't need to do this.
	require "fairy"
	process.removeAllListeners "uncaughtException"
	process.on "uncaughtException", (error) ->
		logger.error err: error, "uncaughtException"

BackgroundTasks.run()

port = Settings.port or Settings.internal?.web?.port or 3000
Server.server.listen port, ->
	logger.info("web-sharelatex listening on port #{port}")
	logger.info("#{require('http').globalAgent.maxSockets} sockets enabled")
	if argv.user
		process.setuid argv.user
		logger.info "Running as user: #{argv.user}"
	if argv.group
		process.setgid argv.group
		logger.info "Running as group: #{argv.group}"
