import { callbackifyAll } from '@overleaf/promise-utils'
import UserMembershipEntityConfigs from './UserMembershipEntityConfigs.mjs'
import * as InstitutionModel from '../../models/Institution.mjs'
import * as SubscriptionModel from '../../models/Subscription.mjs'
import * as PublisherModel from '../../models/Publisher.mjs'
import Features from '../../infrastructure/Features.mjs'

const EntityModels = {
  Institution: InstitutionModel.Institution,
  Subscription: SubscriptionModel.Subscription,
  Publisher: PublisherModel.Publisher,
}

const UserMembershipsHandler = {
  async getEntitiesByUser(entityConfig, userId) {
    if (!Features.hasFeature('saas')) {
      return []
    }
    const query = entityConfig.baseQuery || {}
    query[entityConfig.fields.access] = userId

    const entities =
      (await EntityModels[entityConfig.modelName].find(query)) || []

    const filledEntities = []
    for (const entity of entities) {
      const filled = await entity.fetchV1DataPromise()
      filledEntities.push(filled)
    }
    return filledEntities
  },

  async removeUserFromAllEntities(userId) {
    const entityConfigs = []
    for (const key in UserMembershipEntityConfigs) {
      const entityConfig = UserMembershipEntityConfigs[key]
      if (entityConfig.fields && entityConfig.fields.write != null) {
        entityConfigs.push(entityConfig)
      }
    }

    // remove the user from all entities types
    for (const entityConfig of entityConfigs) {
      await UserMembershipsHandler.removeUserFromEntities(entityConfig, userId)
    }
  },

  async removeUserFromEntities(entityConfig, userId) {
    const removeOperation = { $pull: {} }
    removeOperation.$pull[entityConfig.fields.write] = userId
    await EntityModels[entityConfig.modelName].updateMany({}, removeOperation)
  },
}

export default {
  ...callbackifyAll(UserMembershipsHandler),
  promises: UserMembershipsHandler,
}
