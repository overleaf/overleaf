import mongodb from 'mongodb-legacy'
import { callbackify } from '@overleaf/promise-utils'
import { Institution } from '../../models/Institution.mjs'
import { Subscription } from '../../models/Subscription.mjs'
import { Publisher } from '../../models/Publisher.mjs'
import UserMembershipViewModel from './UserMembershipViewModel.mjs'
import UserGetter from '../User/UserGetter.mjs'
import UserMembershipErrors from './UserMembershipErrors.mjs'

const { ObjectId } = mongodb

const EntityModels = { Institution, Subscription, Publisher }

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
      throw new UserMembershipErrors.UserNotFoundError()
    }

    if (entity[attribute].some(managerId => managerId.equals(user._id))) {
      throw new UserMembershipErrors.UserAlreadyAddedError()
    }

    await addUserToEntity(entity, attribute, user)
    return UserMembershipViewModel.build(user)
  },

  async removeUser(entity, entityConfig, userId) {
    const attribute = entityConfig.fields.write
    if (entity.admin_id ? entity.admin_id.equals(userId) : undefined) {
      throw new UserMembershipErrors.UserIsManagerError()
    }
    return await removeUserFromEntity(entity, attribute, userId)
  },
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

  const users = await UserMembershipViewModel.promises.buildAsync(userObjects)

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

export default {
  getEntityWithoutAuthorizationCheck: callbackify(
    UserMembershipHandler.getEntityWithoutAuthorizationCheck
  ),
  createEntity: callbackify(UserMembershipHandler.createEntity),
  getUsers: callbackify(UserMembershipHandler.getUsers),
  addUser: callbackify(UserMembershipHandler.addUser),
  removeUser: callbackify(UserMembershipHandler.removeUser),
  promises: UserMembershipHandler,
}
