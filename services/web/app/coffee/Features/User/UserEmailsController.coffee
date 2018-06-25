AuthenticationController = require('../Authentication/AuthenticationController')
UserGetter = require("./UserGetter")
UserUpdater = require("./UserUpdater")
EmailHelper = require("../Helpers/EmailHelper")
UserEmailsConfirmationHandler = require "./UserEmailsConfirmationHandler"
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
			return next(error) if error?
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

		UserUpdater.setDefaultEmailAddress userId, email, (error)->
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
