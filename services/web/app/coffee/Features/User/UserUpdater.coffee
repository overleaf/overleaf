logger = require("logger-sharelatex")
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
		logger.log user_id:user_id, newEmail:newEmail, "updaing email address of user"
		UserLocator.findByEmail newEmail, (error, user) ->
			if user?
				return callback({message:"User with that email already exists."})
			self.updateUser user_id.toString(), {
				$set: { "email": newEmail},
			}, (err) ->
				if err?
					logger.err err:err, "problem updating users email"
					return callback(err)
				callback()

