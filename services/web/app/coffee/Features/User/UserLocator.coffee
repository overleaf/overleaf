mongojs = require("../../infrastructure/mongojs")
db = mongojs.db
ObjectId = mongojs.ObjectId

module.exports =

	findByEmail: (email, callback)->
		email = email.trim()
		db.users.findOne email:email, (err, user)->
			callback(err, user)

	findById: (_id, callback)->
		db.users.findOne _id:ObjectId(_id+""), callback