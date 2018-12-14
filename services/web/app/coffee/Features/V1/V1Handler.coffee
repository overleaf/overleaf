V1Api = require './V1Api'
Settings = require 'settings-sharelatex'
logger = require 'logger-sharelatex'


module.exports = V1Handler =

	authWithV1: (email, password, callback=(err, isValid, v1Profile)->) ->
		V1Api.request {
			method: 'POST',
			url: '/api/v1/sharelatex/login',
			json: {email, password},
			expectedStatusCodes: [403]
		}, (err, response, body) ->
			if err?
				logger.err {email, err},
					"[V1Handler] error while talking to v1 login api"
				return callback(err)
			if response.statusCode in [200, 403]
				isValid = body.valid
				userProfile = body.user_profile
				logger.log {email, isValid, v1UserId: body?.user_profile?.id},
					"[V1Handler] got response from v1 login api"
				callback(null, isValid, userProfile)
			else
				err = new Error("Unexpected status from v1 login api: #{response.statusCode}")
				callback(err)

	doPasswordReset: (userData, callback=(err, created)->) ->
		logger.log({v1Id: userData.v1Id, email: userData.email},
			"sending password reset request to v1 login api")
		V1Api.request {
			method: 'POST'
			url: "/api/v1/sharelatex/reset_password"
			json: {
				user_id: userData.v1Id,
				email: userData.email,
				password: userData.password
			}
			expectedStatusCodes: [200]
		}, (err, response, body) ->
			if err?
				logger.err {email: userData.email, err}, "error while talking to v1 password reset api"
				return callback(err, false)
			if response.statusCode in [200]
				logger.log {email: userData.email, changed: true}, "got success response from v1 password reset api"
				callback(null, true)
			else
				err = new Error("Unexpected status from v1 password reset api: #{response.statusCode}")
				callback(err, false)
