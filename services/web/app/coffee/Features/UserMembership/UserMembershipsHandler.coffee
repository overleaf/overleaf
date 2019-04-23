async = require("async")
EntityModels =
	Institution: require('../../models/Institution').Institution
	Subscription: require('../../models/Subscription').Subscription
	Publisher: require('../../models/Publisher').Publisher
UserMembershipEntityConfigs = require "./UserMembershipEntityConfigs"

module.exports = UserMembershipsHandler =
	removeUserFromAllEntities: (userId, callback = (error) ->) ->
		# get all writable entity types
		entityConfigs = []
		for key, entityConfig of UserMembershipEntityConfigs
			entityConfigs.push(entityConfig) if entityConfig.fields.write?

		# remove the user from all entities types
		async.map entityConfigs, ((entityConfig, innerCallback) ->
			UserMembershipsHandler.removeUserFromEntities entityConfig, userId, innerCallback
		), callback

	removeUserFromEntities: (entityConfig, userId, callback = (error) ->) ->
		removeOperation = "$pull": {}
		removeOperation["$pull"][entityConfig.fields.write] = userId
		EntityModels[entityConfig.modelName].updateMany {}, removeOperation, callback

	getEntitiesByUser: (entityConfig, userId, callback = (error, entities) ->) ->
		query = Object.assign({}, entityConfig.baseQuery)
		query[entityConfig.fields.access] = userId
		EntityModels[entityConfig.modelName].find query, (error, entities = []) ->
			return callback(error) if error?
			async.mapSeries entities,
				(entity, cb) -> entity.fetchV1Data(cb),
				callback
