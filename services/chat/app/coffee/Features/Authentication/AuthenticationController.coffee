async = require "async"
logger = require "logger-sharelatex"
WebApiManager = require("../WebApi/WebApiManager")
UserFormatter = require("../Users/UserFormatter")

module.exports = AuthenticationController =
	authClient: (client, data, callback = (error) ->) ->
		logger.log auth_token: data.auth_token, "authenticating user"
		WebApiManager.getUserDetailsFromAuthToken data.auth_token, (error, user) =>
			if error?
				logger.error data: data, client_id: client.id, err: error, "error authenticating user"
				return callback("something went wrong")
			logger.log user: user, auth_token: data.auth_token, "authenticated user"
			user = UserFormatter.formatUserForClientSide user
			jobs = []
			for key, value of user
				do (key, value) ->
					jobs.push (callback) -> client.set key, value, callback
			jobs.push (callback) -> client.set "auth_token", data.auth_token, callback
			async.series jobs, (error, results) =>
				callback(error, user)
			
			
