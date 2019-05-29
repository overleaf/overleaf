/* eslint-disable
    handle-callback-err,
    max-len,
    no-unused-vars,
    standard/no-callback-literal,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { ObjectId } = require('mongoose').Types
const async = require('async')
const Errors = require('../Errors/Errors')
const EntityModels = {
  Institution: require('../../models/Institution').Institution,
  Subscription: require('../../models/Subscription').Subscription,
  Publisher: require('../../models/Publisher').Publisher
}
const UserMembershipViewModel = require('./UserMembershipViewModel')
const UserGetter = require('../User/UserGetter')
const logger = require('logger-sharelatex')
const UserMembershipEntityConfigs = require('./UserMembershipEntityConfigs')

module.exports = {
  getEntity(
    entityId,
    entityConfig,
    loggedInUser,
    requiredStaffAccess,
    callback
  ) {
    if (callback == null) {
      callback = function(error, entity) {}
    }
    const query = buildEntityQuery(entityId, entityConfig)
    if (
      !loggedInUser.isAdmin &&
      !(loggedInUser.staffAccess != null
        ? loggedInUser.staffAccess[requiredStaffAccess]
        : undefined)
    ) {
      query[entityConfig.fields.access] = ObjectId(loggedInUser._id)
    }
    return EntityModels[entityConfig.modelName].findOne(query, callback)
  },

  getEntityWithoutAuthorizationCheck(entityId, entityConfig, callback) {
    if (callback == null) {
      callback = function(error, entity) {}
    }
    const query = buildEntityQuery(entityId, entityConfig)
    return EntityModels[entityConfig.modelName].findOne(query, callback)
  },

  createEntity(entityId, entityConfig, callback) {
    if (callback == null) {
      callback = function(error, entity) {}
    }
    const data = buildEntityQuery(entityId, entityConfig)
    return EntityModels[entityConfig.modelName].create(data, callback)
  },

  getUsers(entity, entityConfig, callback) {
    if (callback == null) {
      callback = function(error, users) {}
    }
    const attributes = entityConfig.fields.read
    return getPopulatedListOfMembers(entity, attributes, callback)
  },

  addUser(entity, entityConfig, email, callback) {
    if (callback == null) {
      callback = function(error, user) {}
    }
    const attribute = entityConfig.fields.write
    return UserGetter.getUserByAnyEmail(email, function(error, user) {
      if (error != null) {
        return callback(error)
      }
      if (!user) {
        return callback({ userNotFound: true })
      }
      if (entity[attribute].some(managerId => managerId.equals(user._id))) {
        return callback({ alreadyAdded: true })
      }

      return addUserToEntity(entity, attribute, user, error =>
        callback(error, UserMembershipViewModel.build(user))
      )
    })
  },

  removeUser(entity, entityConfig, userId, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    const attribute = entityConfig.fields.write
    if (entity.admin_id != null ? entity.admin_id.equals(userId) : undefined) {
      return callback({ isAdmin: true })
    }
    return removeUserFromEntity(entity, attribute, userId, callback)
  }
}

var getPopulatedListOfMembers = function(entity, attributes, callback) {
  if (callback == null) {
    callback = function(error, users) {}
  }
  const userObjects = []

  for (let attribute of Array.from(attributes)) {
    for (let userObject of Array.from(entity[attribute] || [])) {
      // userObject can be an email as String, a user id as ObjectId or an
      // invite as Object with an email attribute as String. We want to pass to
      // UserMembershipViewModel either an email as (String) or a user id (ObjectId)
      const userIdOrEmail = userObject.email || userObject
      userObjects.push(userIdOrEmail)
    }
  }

  return async.map(userObjects, UserMembershipViewModel.buildAsync, callback)
}

var addUserToEntity = function(entity, attribute, user, callback) {
  if (callback == null) {
    callback = function(error) {}
  }
  const fieldUpdate = {}
  fieldUpdate[attribute] = user._id
  return entity.update({ $addToSet: fieldUpdate }, callback)
}

var removeUserFromEntity = function(entity, attribute, userId, callback) {
  if (callback == null) {
    callback = function(error) {}
  }
  const fieldUpdate = {}
  fieldUpdate[attribute] = userId
  return entity.update({ $pull: fieldUpdate }, callback)
}

var buildEntityQuery = function(entityId, entityConfig, loggedInUser) {
  if (ObjectId.isValid(entityId.toString())) {
    entityId = ObjectId(entityId)
  }
  const query = Object.assign({}, entityConfig.baseQuery)
  query[entityConfig.fields.primaryKey] = entityId
  return query
}
