AuthenticationController = require('../Authentication/AuthenticationController')
UserMembershipHandler = require('./UserMembershipHandler')
EntityConfigs = require('./UserMembershipEntityConfigs')
Errors = require('../Errors/Errors')
EmailHelper = require("../Helpers/EmailHelper")
logger = require("logger-sharelatex")

module.exports =
	index: (req, res, next)->
		{ entity, entityConfig } = req
		UserMembershipHandler.getUsers entity, entityConfig, (error, users)->
			return next(error) if error?
			entityPrimaryKey = entity[entityConfig.fields.primaryKey].toString()
			res.render "user_membership/index",
				users: users
				groupSize: entity.membersLimit if entityConfig.hasMembersLimit
				translations: entityConfig.translations
				paths: entityConfig.pathsFor(entityPrimaryKey)

	add: (req, res, next)->
		{ entity, entityConfig } = req
		email = EmailHelper.parseEmail(req.body.email)
		if !email?
			return res.status(400).json error:
				code: 'invalid_email'
				message: req.i18n.translate('invalid_email')


		if entityConfig.readOnly
			return next(new Errors.NotFoundError("Cannot add users to entity"))

		UserMembershipHandler.addUser entity, entityConfig, email, (error, user)->
			if error?.alreadyAdded
				return res.status(400).json error:
					code: 'user_already_added'
					message: req.i18n.translate('user_already_added')
			if error?.userNotFound
				return res.status(404).json error:
					code: 'user_not_found'
					message: req.i18n.translate('user_not_found')
			return next(error) if error?
			res.json(user: user)

	remove: (req, res, next)->
		{ entity, entityConfig } = req
		userId = req.params.userId

		if entityConfig.readOnly
			return next(new Errors.NotFoundError("Cannot remove users from entity"))

		loggedInUserId = AuthenticationController.getLoggedInUserId(req)
		if loggedInUserId == userId
			return res.status(400).json error:
				code: 'managers_cannot_remove_self'
				message: req.i18n.translate('managers_cannot_remove_self')

		UserMembershipHandler.removeUser entity, entityConfig, userId, (error, user)->
			if error?.isAdmin
				return res.status(400).json error:
					code: 'managers_cannot_remove_admin'
					message: req.i18n.translate('managers_cannot_remove_admin')
			return next(error) if error?
			res.send()

	exportCsv: (req, res, next)->
		{ entity, entityConfig } = req
		logger.log subscriptionId: entity._id, "exporting csv"
		UserMembershipHandler.getUsers entity, entityConfig, (error, users)->
			return next(error) if error?
			csvOutput = ""
			for user in users
				csvOutput += user.email + "\n"
			res.header(
				"Content-Disposition",
				"attachment; filename=Group.csv"
			)
			res.contentType('text/csv')
			res.send(csvOutput)
