User = require("../../models/User").User
UserCreator = require("./UserCreator")
UserGetter = require("./UserGetter")
AuthenticationManager = require("../Authentication/AuthenticationManager")
NewsLetterManager = require("../Newsletter/NewsletterManager")
async = require("async")
logger = require("logger-sharelatex")
crypto = require("crypto")
EmailHandler = require("../Email/EmailHandler")
OneTimeTokenHandler = require "../Security/OneTimeTokenHandler"
Analytics = require "../Analytics/AnalyticsManager"
settings = require "settings-sharelatex"
EmailHelper = require("../Helpers/EmailHelper")

module.exports = UserRegistrationHandler =
	hasZeroLengths : (props) ->
		hasZeroLength = false
		props.forEach (prop) ->
			if prop.length == 0
				hasZeroLength = true
		return hasZeroLength

	_registrationRequestIsValid : (body, callback)->
		email = EmailHelper.parseEmail(body.email) or ''
		password = body.password
		if @hasZeroLengths([password, email])
			return false
		else
			return true

	_createNewUserIfRequired: (user, userDetails, callback)->
		if !user?
			userDetails.holdingAccount = false
			UserCreator.createNewUser {holdingAccount:false, email:userDetails.email, first_name:userDetails.first_name, last_name:userDetails.last_name}, callback
		else
			callback null, user

	registerNewUser: (userDetails, callback)->
		self = @
		requestIsValid = @_registrationRequestIsValid userDetails
		if !requestIsValid
			return callback(new Error("request is not valid"))
		userDetails.email = EmailHelper.parseEmail(userDetails.email)
		UserGetter.getUserByAnyEmail userDetails.email, (err, user) =>
			if err?
				return callback err
			if user?.holdingAccount == false
				return callback(new Error("EmailAlreadyRegistered"), user)
			self._createNewUserIfRequired user, userDetails, (err, user)->
				if err?
					return callback(err)
				async.series [
					(cb)-> User.update {_id: user._id}, {"$set":{holdingAccount:false}}, cb
					(cb)-> AuthenticationManager.setUserPassword user._id, userDetails.password, cb
					(cb)->
						if userDetails.subscribeToNewsletter == "true"
							NewsLetterManager.subscribe user, ->
						cb() #this can be slow, just fire it off
				], (err)->
					logger.log user: user, "registered"
					Analytics.recordEvent user._id, "user-registered"
					callback(err, user)
	
	registerNewUserAndSendActivationEmail: (email, callback = (error, user, setNewPasswordUrl) ->) ->
		logger.log {email}, "registering new user"
		UserRegistrationHandler.registerNewUser {
			email: email
			password: crypto.randomBytes(32).toString("hex")
		}, (err, user)->
			if err? and err?.message != "EmailAlreadyRegistered"
				return callback(err)
			
			if err?.message == "EmailAlreadyRegistered"
				logger.log {email}, "user already exists, resending welcome email"

			ONE_WEEK = 7 * 24 * 60 * 60 # seconds
			OneTimeTokenHandler.getNewToken 'password', user._id, { expiresIn: ONE_WEEK }, (err, token)->
				return callback(err) if err?
				
				setNewPasswordUrl = "#{settings.siteUrl}/user/activate?token=#{token}&user_id=#{user._id}"

				EmailHandler.sendEmail "registered", {
					to: user.email
					setNewPasswordUrl: setNewPasswordUrl
				}, () ->
				
				callback null, user, setNewPasswordUrl




