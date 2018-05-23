mongojs = require("../../infrastructure/mongojs")
metrics = require("metrics-sharelatex")
db = mongojs.db
ObjectId = mongojs.ObjectId
logger = require('logger-sharelatex')

module.exports = UserLocator =

	findById: (_id, callback)->
		db.users.findOne _id:ObjectId(_id+""), callback

[
	'findById',
].map (method) ->
	metrics.timeAsyncMethod UserLocator, method, 'mongo.UserLocator', logger
