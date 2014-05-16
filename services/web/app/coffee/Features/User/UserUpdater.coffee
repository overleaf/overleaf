mongojs = require("../../infrastructure/mongojs")
db = mongojs.db
ObjectId = mongojs.ObjectId
UserLocator = require("./UserLocator")

module.exports = UserUpdater =
	updateUser: (query, update, callback = (error) ->) ->
		if typeof query == "string"
			query = _id: ObjectId(query)
		else if query instanceof ObjectId
			query = _id: query

		db.users.update query, update, callback


	changeEmailAddress: (user_id, newEmail, callback)->
		self = @
		UserLocator.findById user_id, (error, user) ->
			if user?
				return callback({message:"User with that email already exists."})
			self.updateUser user_id.toString(), {
				$set: { "email": newEmail},
			}, (err) ->
				if err?
					return callback(err)
				callback()

