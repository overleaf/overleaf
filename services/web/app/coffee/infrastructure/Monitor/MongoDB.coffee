Connection = require("mongoose/node_modules/mongodb/lib/mongodb/connection/connection").Connection
MongoReply = require("mongoose/node_modules/mongodb/lib/mongodb/responses/mongo_reply").MongoReply
Metrics = require("../Metrics")
logger = require "logger-sharelatex"
_ = require("underscore")

connectionMonitor =
	newConnection: (id, db) ->
		Metrics.inc "mongo-requests"
		@connections[id] =
			timer: new Metrics.Timer("mongo-request-times")
			db: db
			start: new Date()
		setTimeout (=> @connectionDone(id)), 60000

	connectionDone: (id) ->

		queryIsNoise = (query)->
			isNoise = false
			if query? && _.isObject(query)
				keys = _.keys(query)
				if keys[0] == "ismaster" or keys[0] == "ping"
					isNoise = true
			return isNoise

		logItOut = (db)->
			logger.log
				request_id: db.requestId,
				query: db.query,
				collection: db.collectionName,
				"response-time": new Date() - start
				"mongo request"



		if @connections[id]?
			@connections[id].timer.done()
			db = @connections[id].db
			start = @connections[id].start
			if !queryIsNoise(db.query)
				logItOut(db)
			delete @connections[id]

	connections: {}

monkeyPatchMongo = () ->
	write = Connection::write
	Connection::write = (db) ->
		write.apply(this, arguments)
		connectionMonitor.newConnection db.requestId, db

	parseHeader = MongoReply::parseHeader
	MongoReply::parseHeader = () ->
		parseHeader.apply this, arguments
		connectionMonitor.connectionDone this.responseTo

module.exports.monitor = monkeyPatchMongo
