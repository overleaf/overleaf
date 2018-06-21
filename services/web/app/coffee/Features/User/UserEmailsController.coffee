AuthenticationController = require('../Authentication/AuthenticationController')
UserGetter = require("./UserGetter")
UserUpdater = require("./UserUpdater")
EmailHelper = require("../Helpers/EmailHelper")
logger = require("logger-sharelatex")

module.exports = UserEmailsController =

	list: (req, res) ->
		userId = AuthenticationController.getLoggedInUserId(req)
		UserGetter.getUserFullEmails userId, (error, fullEmails) ->
			return res.sendStatus 500 if error?
			res.json fullEmails


	add: (req, res) ->
		userId = AuthenticationController.getLoggedInUserId(req)
		email = EmailHelper.parseEmail(req.body.email)
		return res.sendStatus 422 unless email?

		UserUpdater.addEmailAddress userId, email, (error)->
			return res.sendStatus 500 if error?
			res.sendStatus 200


	remove: (req, res) ->
		userId = AuthenticationController.getLoggedInUserId(req)
		logger.log req.params
		email = EmailHelper.parseEmail(req.params.email)
		return res.sendStatus 422 unless email?

		UserUpdater.removeEmailAddress userId, email, (error)->
			return res.sendStatus 500 if error?
			res.sendStatus 200


	setDefault: (req, res) ->
		userId = AuthenticationController.getLoggedInUserId(req)
		email = EmailHelper.parseEmail(req.body.email)
		return res.sendStatus 422 unless email?

		UserUpdater.setDefaultEmailAddress userId, email, (error)->
			return res.sendStatus 500 if error?
			res.sendStatus 200
