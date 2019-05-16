EmailHelper = require "../Helpers/EmailHelper"
EmailHandler = require "../Email/EmailHandler"
OneTimeTokenHandler = require "../Security/OneTimeTokenHandler"
settings = require 'settings-sharelatex'
Errors = require "../Errors/Errors"
logger = require "logger-sharelatex"
UserUpdater = require "./UserUpdater"
UserGetter = require "./UserGetter"

ONE_YEAR_IN_S = 365 * 24 * 60 * 60

module.exports = UserEmailsConfirmationHandler =
	sendConfirmationEmail: (user_id, email, emailTemplate, callback = (error) ->) ->
		if arguments.length == 3
			callback = emailTemplate
			emailTemplate = 'confirmEmail'

		# when force-migrating accounts to v2 from v1, we don't want to send confirmation messages -
		# setting this env var allows us to turn this behaviour off
		return callback(null) if process.env['SHARELATEX_NO_CONFIRMATION_MESSAGES']?

		email = EmailHelper.parseEmail(email)
		return callback(new Error('invalid email')) if !email?
		data = {user_id, email}
		OneTimeTokenHandler.getNewToken 'email_confirmation', data, {expiresIn: ONE_YEAR_IN_S}, (err, token)->
			return callback(err) if err?
			emailOptions =
				to: email
				confirmEmailUrl: "#{settings.siteUrl}/user/emails/confirm?token=#{token}"
				sendingUser_id: user_id
			EmailHandler.sendEmail emailTemplate, emailOptions, callback

	confirmEmailFromToken: (token, callback = (error) ->) ->
		logger.log {token_start: token.slice(0,8)}, 'confirming email from token'
		OneTimeTokenHandler.getValueFromTokenAndExpire 'email_confirmation', token, (error, data) ->
			return callback(error) if error?
			if !data?
				return callback(new Errors.NotFoundError('no token found'))
			{user_id, email} = data
			logger.log {data, user_id, email, token_start: token.slice(0,8)}, 'found data for email confirmation'
			if !user_id? or email != EmailHelper.parseEmail(email)
				return callback(new Errors.NotFoundError('invalid data'))
			UserGetter.getUser user_id, {}, (error, user) ->
				return callback(error) if error?
				unless user?._id
					return callback(new Errors.NotFoundError('user not found'))
				UserUpdater.confirmEmail user_id, email, callback
