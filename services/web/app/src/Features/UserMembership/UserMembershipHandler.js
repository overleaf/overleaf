const { ObjectId } = require('mongodb-legacy')
const { promisifyAll, callbackify } = require('@overleaf/promise-utils')
const EntityModels = {
  Institution: require('../../models/Institution').Institution,
  Subscription: require('../../models/Subscription').Subscription,
  Publisher: require('../../models/Publisher').Publisher,
}
const UserMembershipViewModel = require('./UserMembershipViewModel')
const UserGetter = require('../User/UserGetter')
const {
  UserIsManagerError,
  UserNotFoundError,
  UserAlreadyAddedError,
} = require('./UserMembershipErrors')

const UserMembershipHandler = {
  async getEntityWithoutAuthorizationCheck(entityId, entityConfig) {
    const query = buildEntityQuery(entityId, entityConfig)
    return await EntityModels[entityConfig.modelName].findOne(query).exec()
  },

  async createEntity(entityId, entityConfig) {
    const data = buildEntityQuery(entityId, entityConfig)
    return await EntityModels[entityConfig.modelName].create(data)
  },

  async getUsers(entity, entityConfig) {
    const attributes = entityConfig.fields.read
    return await getPopulatedListOfMembers(entity, attributes)
  },

  async addUser(entity, entityConfig, email) {
    const attribute = entityConfig.fields.write
    const user = await UserGetter.promises.getUserByAnyEmail(email)

    if (!user) {
      throw new UserNotFoundError()
    }

    if (entity[attribute].some(managerId => managerId.equals(user._id))) {
      throw new UserAlreadyAddedError()
    }

    await addUserToEntity(entity, attribute, user)
    return UserMembershipViewModel.build(user)
  },

  async removeUser(entity, entityConfig, userId) {
    const attribute = entityConfig.fields.write
    if (entity.admin_id ? entity.admin_id.equals(userId) : undefined) {
      throw new UserIsManagerError()
    }
    return await removeUserFromEntity(entity, attribute, userId)
  },
}

UserMembershipHandler.promises = promisifyAll(UserMembershipHandler)
module.exports = {
  getEntityWithoutAuthorizationCheck: callbackify(
    UserMembershipHandler.getEntityWithoutAuthorizationCheck
  ),
  createEntity: callbackify(UserMembershipHandler.createEntity),
  getUsers: callbackify(UserMembershipHandler.getUsers),
  addUser: callbackify(UserMembershipHandler.addUser),
  removeUser: callbackify(UserMembershipHandler.removeUser),
  promises: UserMembershipHandler,
}

async function getPopulatedListOfMembers(entity, attributes) {
  const userObjects = []

  for (const attribute of attributes) {
    for (const userObject of entity[attribute] || []) {
      // userObject can be an email as String, a user id as ObjectId or an
      // invite as Object with an email attribute as String. We want to pass to
      // UserMembershipViewModel either an email as (String) or a user id (ObjectId)
      const userIdOrEmail = userObject.email || userObject
      userObjects.push(userIdOrEmail)
    }
  }

  const users = await Promise.all(
    userObjects.map(userObject =>
      UserMembershipViewModel.promises.buildAsync(userObject)
    )
  )

  for (const user of users) {
    if (
      user?._id &&
      entity?.admin_id &&
      user._id.toString() === entity.admin_id.toString()
    ) {
      user.isEntityAdmin = true
    }
  }

  return users
}

async function addUserToEntity(entity, attribute, user) {
  const fieldUpdate = {}
  fieldUpdate[attribute] = user._id
  return await entity.updateOne({ $addToSet: fieldUpdate }).exec()
}

async function removeUserFromEntity(entity, attribute, userId) {
  const fieldUpdate = {}
  fieldUpdate[attribute] = userId
  return await entity.updateOne({ $pull: fieldUpdate }).exec()
}

function buildEntityQuery(entityId, entityConfig) {
  if (ObjectId.isValid(entityId.toString())) {
    entityId = new ObjectId(entityId)
  }
  const query = Object.assign({}, entityConfig.baseQuery)
  query[entityConfig.fields.primaryKey] = entityId
  return query
}
