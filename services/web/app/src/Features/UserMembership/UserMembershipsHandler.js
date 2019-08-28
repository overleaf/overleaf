/* eslint-disable
    handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const async = require('async')
const { promisifyAll } = require('../../util/promises')
const EntityModels = {
  Institution: require('../../models/Institution').Institution,
  Subscription: require('../../models/Subscription').Subscription,
  Publisher: require('../../models/Publisher').Publisher
}
const UserMembershipEntityConfigs = require('./UserMembershipEntityConfigs')

const UserMembershipsHandler = {
  removeUserFromAllEntities(userId, callback) {
    // get all writable entity types
    if (callback == null) {
      callback = function(error) {}
    }
    const entityConfigs = []
    for (let key in UserMembershipEntityConfigs) {
      const entityConfig = UserMembershipEntityConfigs[key]
      if (entityConfig.fields && entityConfig.fields.write != null) {
        entityConfigs.push(entityConfig)
      }
    }

    // remove the user from all entities types
    return async.map(
      entityConfigs,
      (entityConfig, innerCallback) =>
        UserMembershipsHandler.removeUserFromEntities(
          entityConfig,
          userId,
          innerCallback
        ),
      callback
    )
  },

  removeUserFromEntities(entityConfig, userId, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    const removeOperation = { $pull: {} }
    removeOperation['$pull'][entityConfig.fields.write] = userId
    return EntityModels[entityConfig.modelName].updateMany(
      {},
      removeOperation,
      callback
    )
  },

  getEntitiesByUser(entityConfig, userId, callback) {
    if (callback == null) {
      callback = function(error, entities) {}
    }
    const query = Object.assign({}, entityConfig.baseQuery)
    query[entityConfig.fields.access] = userId
    return EntityModels[entityConfig.modelName].find(query, function(
      error,
      entities
    ) {
      if (entities == null) {
        entities = []
      }
      if (error != null) {
        return callback(error)
      }
      return async.mapSeries(
        entities,
        (entity, cb) => entity.fetchV1Data(cb),
        callback
      )
    })
  }
}

UserMembershipsHandler.promises = promisifyAll(UserMembershipsHandler)
module.exports = UserMembershipsHandler
