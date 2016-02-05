Settings = require 'settings-sharelatex'
logger = require 'logger-sharelatex'
logger.initialize("notifications-sharelatex")
express = require('express')
app = express()
controller = require("./app/js/NotificationsController")
mongojs = require('mongojs')
db = mongojs(Settings.mongo.url, ['notifications'])
Path = require("path")
metrics = require("metrics-sharelatex")
metrics.initialize("notifications")
metrics.mongodb.monitor(Path.resolve(__dirname + "/node_modules/mongojs/node_modules/mongodb"), logger)
metrics.memory.monitor(logger)

HealthCheckController = require("./app/js/HealthCheckController")

app.configure ()->
	app.use express.methodOverride()
	app.use express.bodyParser()
	app.use metrics.http.monitor(logger)
	app.use express.errorHandler()

app.post '/user/:user_id', controller.addNotification
app.get '/user/:user_id', controller.getUserNotifications
app.del '/user/:user_id/notification/:notification_id', controller.removeNotificationId
app.del '/user/:user_id', controller.removeNotificationKey

app.get '/status', (req, res)->
	res.send('notifications sharelatex up')

app.get '/health_check', (req, res)->
	HealthCheckController.check (err)->
		if err?
			logger.err err:err, "error performing health check"
			res.send 500
		else
			res.send 200

app.get '*', (req, res)->
	res.send 404

host = Settings.internal?.notifications?.host || "localhost"
port = Settings.internal?.notifications?.port || 3033
app.listen port, host, ->
	logger.info "notifications starting up, listening on #{host}:#{port}"
