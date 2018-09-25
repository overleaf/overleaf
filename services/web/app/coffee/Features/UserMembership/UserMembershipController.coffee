AuthenticationController = require('../Authentication/AuthenticationController')
UserMembershipHandler = require('./UserMembershipHandler')
logger = require("logger-sharelatex")

module.exports =
	index: (entityName, req, res, next)->
		userId = AuthenticationController.getLoggedInUserId(req)

		UserMembershipHandler.getEntity entityName, userId, (error, entity)->
			return next(error) if error?
			UserMembershipHandler.getUsers entityName, entity, (error, users)->
				return next(error) if error?
				res.render "user_membership/index",
					users: users
					entity: entity
					translations: getTranslationsFor(entityName)
					paths: getPathsFor(entityName)

	add: (entityName, req, res, next)->
		userId = AuthenticationController.getLoggedInUserId(req)
		email = req.body.email
		return res.sendStatus 422 unless email

		UserMembershipHandler.getEntity entityName, userId, (error, entity)->
			return next(error) if error?
			UserMembershipHandler.addUser entityName, entity, email, (error, user)->
				return next(error) if error?
				res.json(user: user)

	remove: (entityName, req, res, next)->
		loggedInUserId = AuthenticationController.getLoggedInUserId(req)
		userId = req.params.userId

		UserMembershipHandler.getEntity entityName, loggedInUserId, (error, entity)->
			return next(error) if error?
			UserMembershipHandler.removeUser entityName, entity, userId, (error, user)->
				return next(error) if error?
				res.send()

getTranslationsFor = (entityName) ->
	switch entityName
		when 'group'
			title: 'group_account'
			remove: 'remove_from_group'
		when 'groupManagers'
			title: 'group_managers'
			remove: 'remove_manager'
		when 'institution'
			title: 'institution_managers'
			remove: 'remove_manager'


getPathsFor = (entityName) ->
	switch entityName
		when 'group'
			addMember: '/subscription/invites'
			removeMember: '/subscription/group/user'
			removeInvite: '/subscription/invites'
			exportMembers: '/subscription/group/export'
		when 'groupManagers'
			addMember: "/manage/group/managers"
			removeMember: "/manage/group/managers"
		when 'institution'
			addMember: "/manage/institution/managers"
			removeMember: "/manage/institution/managers"
