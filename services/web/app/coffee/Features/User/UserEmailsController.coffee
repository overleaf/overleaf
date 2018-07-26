AuthenticationController = require('../Authentication/AuthenticationController')
UserGetter = require("./UserGetter")
UserUpdater = require("./UserUpdater")
EmailHelper = require("../Helpers/EmailHelper")
UserEmailsConfirmationHandler = require "./UserEmailsConfirmationHandler"
{ endorseAffiliation } = require("../Institutions/InstitutionsAPI")
logger = require("logger-sharelatex")
Errors = require "../Errors/Errors"

module.exports = UserEmailsController =

	list: (req, res, next) ->
		userId = AuthenticationController.getLoggedInUserId(req)
		UserGetter.getUserFullEmails userId, (error, fullEmails) ->
			return next(error) if error?
			res.json fullEmails


	add: (req, res, next) ->
		userId = AuthenticationController.getLoggedInUserId(req)
		email = EmailHelper.parseEmail(req.body.email)
		return res.sendStatus 422 unless email?

		affiliationOptions =
			university: req.body.university
			role: req.body.role
			department: req.body.department
		UserUpdater.addEmailAddress userId, email, affiliationOptions, (error)->
			if error?
				return UserEmailsController._handleEmailError error, req, res, next
			UserEmailsConfirmationHandler.sendConfirmationEmail userId, email, (err) ->
				return next(error) if error?
				res.sendStatus 204


	remove: (req, res, next) ->
		userId = AuthenticationController.getLoggedInUserId(req)
		email = EmailHelper.parseEmail(req.body.email)
		return res.sendStatus 422 unless email?

		UserUpdater.removeEmailAddress userId, email, (error)->
			return next(error) if error?
			res.sendStatus 200


	setDefault: (req, res, next) ->
		userId = AuthenticationController.getLoggedInUserId(req)
		email = EmailHelper.parseEmail(req.body.email)
		return res.sendStatus 422 unless email?

		UserUpdater.updateV1AndSetDefaultEmailAddress userId, email, (error)->
			if error?
				return UserEmailsController._handleEmailError error, req, res, next
			else
				return res.sendStatus 200


	endorse: (req, res, next) ->
		userId = AuthenticationController.getLoggedInUserId(req)
		email = EmailHelper.parseEmail(req.body.email)
		return res.sendStatus 422 unless email?

		endorseAffiliation userId, email, req.body.role, req.body.department, (error)->
			return next(error) if error?
			res.sendStatus 204

	resendConfirmation: (req, res, next) ->
		userId = AuthenticationController.getLoggedInUserId(req)
		email = EmailHelper.parseEmail(req.body.email)
		return res.sendStatus 422 unless email?
		UserGetter.getUserByAnyEmail email, {_id:1}, (error, user) ->
			return next(error) if error?
			if !user? or user?._id?.toString() != userId
				logger.log {userId, email, foundUserId: user?._id}, "email doesn't match logged in user"
				return res.sendStatus 422
			logger.log {userId, email}, 'resending email confirmation token'
			UserEmailsConfirmationHandler.sendConfirmationEmail userId, email, (error) ->
				return next(error) if error?
				res.sendStatus 200

	showConfirm: (req, res, next) ->
		res.render 'user/confirm_email', {
			token: req.query.token,
			title: 'confirm_email'
		}

	confirm: (req, res, next) ->
		token = req.body.token
		if !token?
			return res.sendStatus 422
		UserEmailsConfirmationHandler.confirmEmailFromToken token, (error) ->
			if error?
				if error instanceof Errors.NotFoundError
					res.status(404).json({
						message: 'Sorry, your confirmation token is invalid or has expired. Please request a new email confirmation link.'
					})
				else
					next(error)
			else
				res.sendStatus 200

	_handleEmailError: (error, req, res, next) ->
		if error instanceof Errors.UnconfirmedEmailError
			return res.status(409).json {
				message: 'email must be confirmed'
			}
		else if error instanceof Errors.EmailExistsError
			return res.status(409).json {
				message: req.i18n.translate("email_already_registered")
			}
		else
			return next(error)