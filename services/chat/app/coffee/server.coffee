logger = require 'logger-sharelatex'
logger.initialize("chat-sharelatex")
metrics = require("metrics-sharelatex")
metrics.initialize("chat")
Path = require("path")
express = require("express")
app = express()
server = require("http").createServer(app)
Router = require "./router"

metrics.mongodb.monitor(Path.resolve(__dirname + "/../../node_modules/mongojs/node_modules/mongodb"), logger)

app.use express.bodyParser()
app.use metrics.http.monitor(logger)

if (app.get 'env') == 'development'
	console.log "Development Enviroment"
	app.use express.errorHandler({ dumpExceptions: true, showStack: true })

if (app.get 'env') == 'production'
	console.log "Production Enviroment"
	app.use express.logger()
	app.use express.errorHandler()
	
profiler = require "v8-profiler"
app.get "/profile", (req, res) ->
	time = parseInt(req.query.time || "1000")
	profiler.startProfiling("test")
	setTimeout () ->
		profile = profiler.stopProfiling("test")
		res.json(profile)
	, time

Router.route(app)

module.exports = {
	server: server
	app: app
}


