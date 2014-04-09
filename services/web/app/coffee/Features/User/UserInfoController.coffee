UserGetter = require "./UserGetter"
logger = require("logger-sharelatex")
UserDeleter = require("./UserDeleter")

module.exports = UserController =
	getLoggedInUsersPersonalInfo: (req, res, next = (error) ->) ->
		# this is funcky as hell, we don't use the current session to get the user
		# we use the auth token, actually destroying session from the chat api request
		req.session.destroy() 
		logger.log user: req.user, "reciving request for getting logged in users personal info"
		return next(new Error("User is not logged in")) if !req.user?
		UserController.sendFormattedPersonalInfo(req.user, res, next)

	getPersonalInfo: (req, res, next = (error) ->) ->
		UserGetter.getUser req.params.user_id, { _id: true, first_name: true, last_name: true, email: true }, (error, user) ->
			logger.log user: req.params.user_id, "reciving request for getting users personal info"
			return next(error) if error?
			return res.send(404) if !user?
			UserController.sendFormattedPersonalInfo(user, res, next)
			req.session.destroy()


	sendFormattedPersonalInfo: (user, res, next = (error) ->) ->
		UserController._formatPersonalInfo user, (error, info) ->
			return next(error) if error?
			res.send JSON.stringify(info)

	deleteUser: (req, res)->
		user_id = req.session.user._id
		UserDeleter.deleteUser user_id, (err)->
			if !err?
				req.session.destroy()
			res.send(200)
			
	_formatPersonalInfo: (user, callback = (error, info) ->) ->
		callback null, {
			id: user._id.toString()
			first_name: user.first_name
			last_name: user.last_name
			email: user.email
			signUpDate: user.signUpDate
		}
		

	
