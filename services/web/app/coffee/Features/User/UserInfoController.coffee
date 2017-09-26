UserGetter = require "./UserGetter"
logger = require("logger-sharelatex")
UserDeleter = require("./UserDeleter")
UserUpdater = require("./UserUpdater")
sanitize = require('sanitizer')
AuthenticationController = require('../Authentication/AuthenticationController')
ObjectId = require("mongojs").ObjectId

module.exports = UserController =
	getLoggedInUsersPersonalInfo: (req, res, next = (error) ->) ->
		user_id = AuthenticationController.getLoggedInUserId(req)
		logger.log user_id: user_id, "reciving request for getting logged in users personal info"
		return next(new Error("User is not logged in")) if !user_id?
		UserGetter.getUser user_id, {
			first_name: true, last_name: true,
			role:true, institution:true,
			email: true, signUpDate: true
		}, (error, user) ->
			return next(error) if error?
			UserController.sendFormattedPersonalInfo(user, res, next)

	getPersonalInfo: (req, res, next = (error) ->) ->
		{user_id} = req.params

		if user_id.match(/^\d+$/)
			query = { "overleaf.id": parseInt(user_id, 10) }
		else if user_id.match(/^[a-f0-9]{24}$/)
			query = { _id: ObjectId(user_id) }
		else
			return res.send(400)

		UserGetter.getUser query, { _id: true, first_name: true, last_name: true, email: true}, (error, user) ->
			logger.log user_id: req.params.user_id, "receiving request for getting users personal info"
			return next(error) if error?
			return res.send(404) if !user?
			UserController.sendFormattedPersonalInfo(user, res, next)

	sendFormattedPersonalInfo: (user, res, next = (error) ->) ->
		info = UserController.formatPersonalInfo(user)
		res.send JSON.stringify(info)

	formatPersonalInfo: (user, callback = (error, info) ->) ->
		if !user?
			return {}
		formatted_user = { id: user._id.toString() }
		for key in ["first_name", "last_name", "email", "signUpDate", "role", "institution"]
			if user[key]?
				formatted_user[key] = user[key]
		return formatted_user
