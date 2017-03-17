mongojs = require("../../infrastructure/mongojs")
metrics = require("../../infrastructure/Metrics")
db = mongojs.db
ObjectId = mongojs.ObjectId
logger = require('logger-sharelatex')

module.exports = UserLocator =

	findByEmail: (email, callback)->
		email = email.trim()
		db.users.findOne email:email, (err, user)->
			callback(err, user)

	findById: (_id, callback)->
		db.users.findOne _id:ObjectId(_id+""), callback

[
	'findById',
	'findByEmail'
].map (method) ->
	metrics.timeAsyncMethod UserLocator, method, 'mongo.UserLocator', logger
