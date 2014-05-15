settings = require("settings-sharelatex")
async = require("async")
UserGetter = require("../User/UserGetter")
TokenGenerator = require("./TokenGenerator")
EmailHandler = require("../Email/EmailHandler")
AuthenticationManager = require("../Authentication/AuthenticationManager")
logger = require("logger-sharelatex")

module.exports =

	generateAndEmailResetToken:(email, callback)->
		UserGetter.getUser email:email, (err, user)->
			if err then return callback(err)
			if !user?
				logger.err email:email, "user could not be found for password reset"
				return callback("no user found")
			TokenGenerator.getNewToken user._id, (err, token)->
				if err then return callback(err)
				emailOptions =
					to : email
					setNewPasswordUrl : "#{settings.siteUrl}/user/password/set?passwordResetToken=#{token}"
				EmailHandler.sendEmail "passwordResetRequested", emailOptions, callback		

	setNewUserPassword: (token, password, callback)->
		TokenGenerator.getUserIdFromToken token, (err, user_id)->
			if err then return callback(err)
			if !user_id?
				logger.err user_id:user_id, "token for password reset did not find user_id"
				return callback("no user found")
			AuthenticationManager.setUserPassword user_id, password, callback