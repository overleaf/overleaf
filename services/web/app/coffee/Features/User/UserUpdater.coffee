logger = require("logger-sharelatex")
mongojs = require("../../infrastructure/mongojs")
metrics = require("metrics-sharelatex")
db = mongojs.db
async = require("async")
ObjectId = mongojs.ObjectId
UserGetter = require("./UserGetter")

module.exports = UserUpdater =
	updateUser: (query, update, callback = (error) ->) ->
		if typeof query == "string"
			query = _id: ObjectId(query)
		else if query instanceof ObjectId
			query = _id: query
		else if typeof query._id == "string"
			query._id = ObjectId(query._id)

		db.users.update query, update, callback


	#
	# DEPRECATED
	#
	# Change the user's main email address by adding a new email, switching the
	# default email and removing the old email.  Prefer manipulating multiple
	# emails and the default rather than calling this method directly
	#
	changeEmailAddress: (userId, newEmail, callback)->
		logger.log userId: userId, newEmail: newEmail, "updaing email address of user"

		oldEmail = null
		async.series [
			(cb) ->
				UserGetter.getUserEmail userId, (error, email) ->
					oldEmail = email
					cb(error)
			(cb) -> UserUpdater.addEmailAddress userId, newEmail, cb
			(cb) -> UserUpdater.setDefaultEmailAddress userId, newEmail, cb
			(cb) -> UserUpdater.removeEmailAddress userId, oldEmail, cb
		], callback


	# Add a new email address for the user. Email cannot be already used by this
	# or any other user
	addEmailAddress: (userId, newEmail, callback) ->
		@_ensureUniqueEmailAddress newEmail, (error) =>
			return callback(error) if error?

			update = $push: emails: email: newEmail, createdAt: new Date()
			@updateUser userId, update, (error) ->
				if error?
					logger.err error: error, 'problem updating users emails'
					return callback(error)
				callback()


	# remove one of the user's email addresses. The email cannot be the user's
	# default email address
	removeEmailAddress: (userId, email, callback) ->
		query = _id: userId, email: $ne: email
		update = $pull: emails: email: email
		@updateUser query, update, (error, res) ->
			if error?
				logger.err error:error, 'problem removing users email'
				return callback(error)
			if res.nMatched == 0
				return callback(new Error('Cannot remove default email'))
			callback()


	# set the default email address by setting the `email` attribute. The email
	# must be one of the user's multiple emails (`emails` attribute)
	setDefaultEmailAddress: (userId, email, callback) ->
		query = _id: userId, 'emails.email': email
		update = $set: email: email
		@updateUser query, update, (error, res) ->
			if error?
				logger.err error:error, 'problem setting default emails'
				return callback(error)
			if res.nMatched == 0
				return callback(new Error('Default email does not belong to user'))
			callback()


	# check for duplicate email address. This is also enforced at the DB level
	_ensureUniqueEmailAddress: (newEmail, callback) ->
		UserGetter.getUserByAnyEmail newEmail, (error, user) ->
			return callback(message: 'alread_exists') if user?
			callback()


[
	'updateUser'
	'changeEmailAddress'
	'setDefaultEmailAddress'
	'addEmailAddress'
	'removeEmailAddress'
	'_ensureUniqueEmailAddress'
].map (method) ->
	metrics.timeAsyncMethod(UserUpdater, method, 'mongo.UserUpdater', logger)
