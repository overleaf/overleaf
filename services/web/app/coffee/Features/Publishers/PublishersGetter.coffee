UserMembershipHandler = require "../UserMembership/UserMembershipHandler"
UserMembershipEntityConfigs = require "../UserMembership/UserMembershipEntityConfigs"
logger = require 'logger-sharelatex'
_ = require 'underscore'

module.exports = PublishersGetter =
	getManagedPublishers: (user_id, callback = (error, managedPublishers) ->) ->
		UserMembershipHandler.getEntitiesByUser UserMembershipEntityConfigs.publisher, user_id, (error, managedPublishers) ->
			callback(error, managedPublishers)
