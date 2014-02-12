mongojs = require("../../infrastructure/mongojs")
db = mongojs.db
ObjectId = mongojs.ObjectId

module.exports = UserGetter =
	getUser: (query, projection, callback = (error, user) ->) ->
		if arguments.length == 2
			callback = projection
			projection = {}
		if typeof query == "string"
			query = _id: ObjectId(query)
		else if query instanceof ObjectId
			query = _id: query

		db.users.findOne query, projection, callback
