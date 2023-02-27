/* eslint-disable
    n/handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { ObjectId } = require('mongodb')
const async = require('async')
const { promisifyAll } = require('../../util/promises')
const Errors = require('../Errors/Errors')
const EntityModels = {
  Institution: require('../../models/Institution').Institution,
  Subscription: require('../../models/Subscription').Subscription,
  Publisher: require('../../models/Publisher').Publisher,
}
const UserMembershipViewModel = require('./UserMembershipViewModel')
const UserGetter = require('../User/UserGetter')
const logger = require('@overleaf/logger')
const UserMembershipEntityConfigs = require('./UserMembershipEntityConfigs')
const { UserIsManagerError } = require('./UserMembershipErrors')

const UserMembershipHandler = {
  getEntityWithoutAuthorizationCheck(entityId, entityConfig, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const query = buildEntityQuery(entityId, entityConfig)
    EntityModels[entityConfig.modelName].findOne(query, callback)
  },

  createEntity(entityId, entityConfig, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const data = buildEntityQuery(entityId, entityConfig)
    EntityModels[entityConfig.modelName].create(data, callback)
  },

  getUsers(entity, entityConfig, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const attributes = entityConfig.fields.read
    getPopulatedListOfMembers(entity, attributes, callback)
  },

  addUser(entity, entityConfig, email, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const attribute = entityConfig.fields.write
    UserGetter.getUserByAnyEmail(email, function (error, user) {
      if (error != null) {
        return callback(error)
      }
      if (!user) {
        const err = { userNotFound: true }
        return callback(err)
      }
      if (entity[attribute].some(managerId => managerId.equals(user._id))) {
        error = { alreadyAdded: true }
        return callback(error)
      }

      addUserToEntity(entity, attribute, user, error =>
        callback(error, UserMembershipViewModel.build(user))
      )
    })
  },

  removeUser(entity, entityConfig, userId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const attribute = entityConfig.fields.write
    if (entity.admin_id != null ? entity.admin_id.equals(userId) : undefined) {
      return callback(new UserIsManagerError())
    }
    removeUserFromEntity(entity, attribute, userId, callback)
  },
}

UserMembershipHandler.promises = promisifyAll(UserMembershipHandler)
module.exports = UserMembershipHandler

function getPopulatedListOfMembers(entity, attributes, callback) {
  if (callback == null) {
    callback = function () {}
  }
  const userObjects = []

  for (const attribute of Array.from(attributes)) {
    for (const userObject of Array.from(entity[attribute] || [])) {
      // userObject can be an email as String, a user id as ObjectId or an
      // invite as Object with an email attribute as String. We want to pass to
      // UserMembershipViewModel either an email as (String) or a user id (ObjectId)
      const userIdOrEmail = userObject.email || userObject
      userObjects.push(userIdOrEmail)
    }
  }

  async.map(userObjects, UserMembershipViewModel.buildAsync, callback)
}

function addUserToEntity(entity, attribute, user, callback) {
  if (callback == null) {
    callback = function () {}
  }
  const fieldUpdate = {}
  fieldUpdate[attribute] = user._id
  entity.updateOne({ $addToSet: fieldUpdate }, callback)
}

function removeUserFromEntity(entity, attribute, userId, callback) {
  if (callback == null) {
    callback = function () {}
  }
  const fieldUpdate = {}
  fieldUpdate[attribute] = userId
  entity.updateOne({ $pull: fieldUpdate }, callback)
}

function buildEntityQuery(entityId, entityConfig, loggedInUser) {
  if (ObjectId.isValid(entityId.toString())) {
    entityId = ObjectId(entityId)
  }
  const query = Object.assign({}, entityConfig.baseQuery)
  query[entityConfig.fields.primaryKey] = entityId
  return query
}
