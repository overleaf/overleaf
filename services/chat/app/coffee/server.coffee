logger = require 'logger-sharelatex'
logger.initialize("chat-sharelatex")
metrics = require("metrics-sharelatex")
metrics.initialize("chat")
Path = require("path")
express = require("express")
app = express()
server = require("http").createServer(app)
io = require("socket.io").listen(server)
io.set("resource", "/chat/socket.io")
io.set("log level", 1)
Router = require "./router"

metrics.mongodb.monitor(Path.resolve(__dirname + "/../../node_modules/mongojs/node_modules/mongodb"), logger)

app.configure ()->
	app.use express.bodyParser()
	app.use metrics.http.monitor(logger)
	Router.route(app, io)

app.configure 'development', ->
	console.log "Development Enviroment"
	app.use express.errorHandler({ dumpExceptions: true, showStack: true })

app.configure 'production', ->
	console.log "Production Enviroment"
	app.use express.logger()
	app.use express.errorHandler()



mountPoint = "/chat"
app.use (req, res, next) ->

	if req.url.slice(0, mountPoint.length) == mountPoint
		req.url = req.url.slice(mountPoint.length)
		next()
	else
		res.send(404)

app.use(express.static(__dirname + "/../../public/build"))



module.exports = {
	server: server
	io: io
	app: app
}

require("./Features/Sockets/RealTimeEventManager").listenForChatEvents()

