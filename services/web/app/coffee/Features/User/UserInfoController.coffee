UserGetter = require "./UserGetter"
logger = require("logger-sharelatex")
UserDeleter = require("./UserDeleter")
UserUpdater = require("./UserUpdater")
sanitize = require('sanitizer')

module.exports = UserController =
	getLoggedInUsersPersonalInfo: (req, res, next = (error) ->) ->
		# this is funcky as hell, we don't use the current session to get the user
		# we use the auth token, actually destroying session from the chat api request
		if req.query?.auth_token?
			req.session.destroy() 
		logger.log user: req.user, "reciving request for getting logged in users personal info"
		return next(new Error("User is not logged in")) if !req.user?
		UserGetter.getUser req.user._id, {
			first_name: true, last_name: true,
			role:true, institution:true,
			email: true, signUpDate: true
		}, (error, user) ->
			return next(error) if error?
			UserController.sendFormattedPersonalInfo(user, res, next)

	getPersonalInfo: (req, res, next = (error) ->) ->
		UserGetter.getUser req.params.user_id, { _id: true, first_name: true, last_name: true, email: true}, (error, user) ->
			logger.log user_id: req.params.user_id, "reciving request for getting users personal info"
			return next(error) if error?
			return res.send(404) if !user?
			UserController.sendFormattedPersonalInfo(user, res, next)
			req.session.destroy()

	updatePersonalInfo: (req, res, next = (error)->) ->
		{first_name, last_name, role, institution} = req.body
		user_id = req.session.user._id
		logger.log data:req.body, user_id:user_id, "getting update for user personal info"
		update = 
			first_name:sanitize.escape(first_name)
			last_name:sanitize.escape(last_name)
			role:sanitize.escape(role)
			institution:sanitize.escape(institution)
		UserUpdater.updatePersonalInfo user_id, update, (err)->
			if err?
				res.send 500
			else
				res.send 204

	sendFormattedPersonalInfo: (user, res, next = (error) ->) ->
		UserController._formatPersonalInfo user, (error, info) ->
			return next(error) if error?
			res.send JSON.stringify(info)

	_formatPersonalInfo: (user, callback = (error, info) ->) ->
		callback null, {
			id: user._id.toString()
			first_name: user.first_name
			last_name: user.last_name
			email: user.email
			signUpDate: user.signUpDate
			role: user.role
			institution: user.institution
		}
		

	
