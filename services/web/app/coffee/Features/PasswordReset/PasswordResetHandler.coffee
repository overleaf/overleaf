settings = require("settings-sharelatex")
async = require("async")
UserGetter = require("../User/UserGetter")
TokenGenerator = require("./TokenGenerator")
EmailHandler = require("../Email/EmailHandler")
AuthenticationManager = require("../Authentication/AuthenticationManager")

module.exports =

	generateAndEmailResetToken:(user_id, callback)->
		async.series
			user: (cb)-> UserGetter.getUser _id:user_id, cb
			token: (cb)-> TokenGenerator.getNewToken user_id, cb
		, (err, results)->
			if err then return callback(err)
			if !results.user?
				return callback("no user found")
			emailOptions =
				to : results.user.email
				setNewPasswordUrl : "#{settings.siteUrl}/user/password/set?resetToken=#{results.token}"
			EmailHandler.sendEmail "passwordResetRequested", emailOptions, callback		

	setNewUserPassowrd: (token, password, callback)->
		TokenGenerator.getUserIdFromToken token, (err, user_id)->
			if err then return callback(err)
			if !user_id?
				return callback("no user found")
			AuthenticationManager.setUserPassword user_id, password, callback