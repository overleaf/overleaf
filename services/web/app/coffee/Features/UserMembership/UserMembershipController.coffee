AuthenticationController = require('../Authentication/AuthenticationController')
UserMembershipHandler = require('./UserMembershipHandler')
EntityConfigs = require('./UserMembershipEntityConfigs')
Errors = require('../Errors/Errors')
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
		email = req.body.email
		return res.sendStatus 422 unless email

		if entityConfig.readOnly
			return next(new Errors.NotFoundError("Cannot add users to entity"))

		UserMembershipHandler.addUser entity, entityConfig, email, (error, user)->
			return next(error) if error?
			res.json(user: user)

	remove: (req, res, next)->
		{ entity, entityConfig } = req
		userId = req.params.userId

		if entityConfig.readOnly
			return next(new Errors.NotFoundError("Cannot remove users from entity"))

		UserMembershipHandler.removeUser entity, entityConfig, userId, (error, user)->
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
