EmailHelper = require "../Helpers/EmailHelper"
EmailHandler = require "../Email/EmailHandler"
OneTimeTokenHandler = require "../Security/OneTimeTokenHandler"
settings = require 'settings-sharelatex'
Errors = require "../Errors/Errors"
logger = require "logger-sharelatex"
UserUpdater = require "./UserUpdater"

ONE_YEAR_IN_S = 365 * 24 * 60 * 60

module.exports = UserEmailsConfirmationHandler =
	serializeData: (user_id, email) ->
		JSON.stringify({user_id, email})

	deserializeData: (data) ->
		JSON.parse(data)

	sendConfirmationEmail: (user_id, email, emailTemplate, callback = (error) ->) ->
		if arguments.length == 3
			callback = emailTemplate
			emailTemplate = 'confirmEmail'
		email = EmailHelper.parseEmail(email)
		return callback(new Error('invalid email')) if !email?
		value = UserEmailsConfirmationHandler.serializeData(user_id, email)
		OneTimeTokenHandler.getNewToken 'email_confirmation', value, {expiresIn: ONE_YEAR_IN_S}, (err, token)->
			return callback(err) if err?
			emailOptions =
				to: email
				confirmEmailUrl: "#{settings.siteUrl}/user/emails/confirm?token=#{token}"
			EmailHandler.sendEmail emailTemplate, emailOptions, callback

	confirmEmailFromToken: (token, callback = (error) ->) ->
		logger.log {token_start: token.slice(0,8)}, 'confirming email from token'
		OneTimeTokenHandler.getValueFromTokenAndExpire 'email_confirmation', token, (error, data) ->
			return callback(error) if error?
			if !data?
				return callback(new Errors.NotFoundError('no token found'))
			{user_id, email} = UserEmailsConfirmationHandler.deserializeData(data)
			logger.log {data, user_id, email, token_start: token.slice(0,8)}, 'found data for email confirmation'
			if !user_id? or email != EmailHelper.parseEmail(email)
				return callback(new Errors.NotFoundError('invalid data'))
			UserUpdater.confirmEmail user_id, email, callback
