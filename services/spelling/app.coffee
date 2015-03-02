Settings = require 'settings-sharelatex'
logger = require 'logger-sharelatex'
logger.initialize("spelling-sharelatex")
SpellingAPIController = require './app/js/SpellingAPIController'
restify = require 'restify'
Path = require("path")
metrics = require("metrics-sharelatex")
metrics.initialize("spelling")
metrics.mongodb.monitor(Path.resolve(__dirname + "/node_modules/mongojs/node_modules/mongodb"), logger)
HealthCheckController = require("./app/js/HealthCheckController")


server = restify.createServer
	name: "spelling-sharelatex",
	version: "0.0.1"

server.use restify.bodyParser(mapParams: false)
server.use metrics.http.monitor(logger)

server.post "/user/:user_id/check", SpellingAPIController.check
server.post "/user/:user_id/learn", SpellingAPIController.learn
server.get "/status", (req, res)->
	res.send(status:'spelling api is up')

server.get "/health_check", HealthCheckController.healthCheck

profiler = require "v8-profiler"
server.get "/profile", (req, res) ->
	time = parseInt(req.query.time || "1000")
	profiler.startProfiling("test")
	setTimeout () ->
		profile = profiler.stopProfiling("test")
		res.json(profile)
	, time

host = Settings.internal?.spelling?.host || "localhost"
port = Settings.internal?.spelling?.port || 3005
server.listen port, host, (error) ->
	throw error if error?
	logger.log "spelling-sharelatex listening at #{host}:#{port}"
