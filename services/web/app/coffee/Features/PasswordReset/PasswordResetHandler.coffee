settings = require("settings-sharelatex")
async = require("async")
UserGetter = require("../User/UserGetter")
OneTimeTokenHandler = require("../Security/OneTimeTokenHandler")
EmailHandler = require("../Email/EmailHandler")
AuthenticationManager = require("../Authentication/AuthenticationManager")
logger = require("logger-sharelatex")
V1Api = require("../V1/V1Api")

module.exports = PasswordResetHandler =

	generateAndEmailResetToken:(email, callback = (error, status) ->)->
		PasswordResetHandler._getPasswordResetData email, (error, exists, data) ->
			if error?
				return callback(error, null)
			else if exists
				OneTimeTokenHandler.getNewToken 'password', data, (err, token)->
					if err then return callback(err)
					emailOptions =
						to : email
						setNewPasswordUrl : "#{settings.siteUrl}/user/password/set?passwordResetToken=#{token}&email=#{encodeURIComponent(email)}"
					EmailHandler.sendEmail "passwordResetRequested", emailOptions, (error) ->
						return callback(error) if error?
						callback null, 'primary'
			else
				UserGetter.getUserByAnyEmail email, (err, user) ->
					if !user
						return callback(error, null)
					else if !user.overleaf?.id?
						return callback(error, 'sharelatex')
					else
						return callback(error, 'secondary')

	setNewUserPassword: (token, password, callback = (error, found, user_id) ->)->
		OneTimeTokenHandler.getValueFromTokenAndExpire 'password', token, (err, data)->
			if err then return callback(err)
			if !data?
				return callback null, false, null
			if typeof data == "string"
				# Backwards compatible with old format.
				# Tokens expire after 1h, so this can be removed soon after deploy.
				# Possibly we should keep this until we do an onsite release too.
				data = { user_id: data } 
			if data.user_id?
				AuthenticationManager.setUserPassword data.user_id, password, (err, reset) ->
					if err then return callback(err)
					callback null, reset, data.user_id
			else if data.v1_user_id?
				AuthenticationManager.setUserPasswordInV1 data.v1_user_id, password, (error, reset) ->
					return callback(error) if error?
					UserGetter.getUser { 'overleaf.id': data.v1_user_id }, {_id:1}, (error, user) ->
						return callback(error) if error?
						callback null, reset, user?._id

	_getPasswordResetData: (email, callback = (error, exists, data) ->) ->
		if settings.overleaf?
			# Overleaf v2
			V1Api.request {
				url: "/api/v1/sharelatex/user_emails"
				qs:
					email: email
				expectedStatusCodes: [404]
			}, (error, response, body) ->
				return callback(error) if error?
				if response.statusCode == 404
					return callback null, false
				else
					return callback null, true, { v1_user_id: body.user_id }
		else
			# ShareLaTeX
			UserGetter.getUserByMainEmail email, (err, user)->
				if err then return callback(err)
				if !user? or user.holdingAccount or user.overleaf?
					logger.err email:email, "user could not be found for password reset"
					return callback(null, false)
				return callback null, true, { user_id: user._id }
