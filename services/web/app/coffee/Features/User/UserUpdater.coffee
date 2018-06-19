logger = require("logger-sharelatex")
mongojs = require("../../infrastructure/mongojs")
metrics = require("metrics-sharelatex")
db = mongojs.db
async = require("async")
ObjectId = mongojs.ObjectId
UserGetter = require("./UserGetter")
EmailHelper = require "../Helpers/EmailHelper"
Errors = require "../Errors/Errors"
settings = require "settings-sharelatex"
request = require "request"

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
	addEmailAddress: (userId, newEmail, affiliationOptions, callback) ->
		unless callback? # affiliationOptions is optional
			callback = affiliationOptions
			affiliationOptions = {}

		UserGetter.ensureUniqueEmailAddress newEmail, (error) =>
			return callback(error) if error?

			addAffiliation userId, newEmail, affiliationOptions, (error) =>
				if error?
					logger.err error: error, 'problem adding affiliation'
					return callback(error)

				update = $push: emails: email: newEmail, createdAt: new Date()
				@updateUser userId, update, (error) ->
					if error?
						logger.err error: error, 'problem updating users emails'
						return callback(error)
					callback()

	# remove one of the user's email addresses. The email cannot be the user's
	# default email address
	removeEmailAddress: (userId, email, callback) ->
		removeAffiliation userId, email, (error) =>
			if error?
				logger.err error: error, 'problem removing affiliation'
				return callback(error)

			query = _id: userId, email: $ne: email
			update = $pull: emails: email: email
			@updateUser query, update, (error, res) ->
				if error?
					logger.err error:error, 'problem removing users email'
					return callback(error)
				if res.n == 0
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
			if res.n == 0 # TODO: Check n or nMatched?
				return callback(new Error('Default email does not belong to user'))
			callback()

	confirmEmail: (userId, email, callback) ->
		email = EmailHelper.parseEmail(email)
		return callback(new Error('invalid email')) if !email?
		logger.log {userId, email}, 'confirming user email'
		query =
			_id: userId
			'emails.email': email
		update =
			$set:
				'emails.$.confirmedAt': new Date()
		@updateUser query, update, (error, res) ->
			return callback(error) if error?
			logger.log {res, userId, email}, "tried to confirm email"
			if res.n == 0
				return callback(new Errors.NotFoundError('user id and email do no match'))
			callback()

addAffiliation = (userId, email, { university, department, role }, callback = (error) ->) ->
	makeAffiliationRequest {
		method: 'POST'
		path: "/api/v2/users/#{userId.toString()}/affiliations"
		body: { email, university, department, role }
		defaultErrorMessage: "Couldn't create affiliation"
	}, callback

removeAffiliation = (userId, email, callback = (error) ->) ->
	email = encodeURIComponent(email)
	makeAffiliationRequest {
		method: 'DELETE'
		path: "/api/v2/users/#{userId.toString()}/affiliations/#{email}"
		extraSuccessStatusCodes: [404] # `Not Found` responses are considered successful
		defaultErrorMessage: "Couldn't remove affiliation"
	}, callback

makeAffiliationRequest = (requestOptions,  callback = (error) ->) ->
	requestOptions.extraSuccessStatusCodes ||= []
	request {
		method: requestOptions.method
		url: "#{settings.apis.v1.url}#{requestOptions.path}"
		body: requestOptions.body
		auth: { user: settings.apis.v1.user, pass: settings.apis.v1.pass }
		json: true,
		timeout: 20 * 1000
	}, (error, response, body) ->
		return callback(error) if error?
		isSuccess = 200 <= response.statusCode < 300
		isSuccess ||= response.statusCode in requestOptions.extraSuccessStatusCodes
		unless isSuccess
			if body?.errors
				errorMessage = "#{response.statusCode}: #{body.errors}"
			else
				errorMessage = "#{requestOptions.defaultErrorMessage}: #{response.statusCode}"
			return callback(new Error(errorMessage))

		callback(null)

[
	'updateUser'
	'changeEmailAddress'
	'setDefaultEmailAddress'
	'addEmailAddress'
	'removeEmailAddress'
].map (method) ->
	metrics.timeAsyncMethod(UserUpdater, method, 'mongo.UserUpdater', logger)
