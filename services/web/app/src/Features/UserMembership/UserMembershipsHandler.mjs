/* eslint-disable
    n/handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import async from 'async'

import { promisifyAll } from '@overleaf/promise-utils'
import UserMembershipEntityConfigs from './UserMembershipEntityConfigs.mjs'
import * as InstitutionModel from '../../models/Institution.mjs'
import * as SubscriptionModel from '../../models/Subscription.mjs'
import * as PublisherModel from '../../models/Publisher.mjs'

const EntityModels = {
  Institution: InstitutionModel.Institution,
  Subscription: SubscriptionModel.Subscription,
  Publisher: PublisherModel.Publisher,
}

const UserMembershipsHandler = {
  removeUserFromAllEntities(userId, callback) {
    // get all writable entity types
    if (callback == null) {
      callback = function () {}
    }
    const entityConfigs = []
    for (const key in UserMembershipEntityConfigs) {
      const entityConfig = UserMembershipEntityConfigs[key]
      if (entityConfig.fields && entityConfig.fields.write != null) {
        entityConfigs.push(entityConfig)
      }
    }

    // remove the user from all entities types
    async.map(
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
      callback = function () {}
    }
    const removeOperation = { $pull: {} }
    removeOperation.$pull[entityConfig.fields.write] = userId
    EntityModels[entityConfig.modelName]
      .updateMany({}, removeOperation)
      .then(result => callback(null, result))
      .catch(callback)
  },

  getEntitiesByUser(entityConfig, userId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const query = Object.assign({}, entityConfig.baseQuery)
    query[entityConfig.fields.access] = userId
    EntityModels[entityConfig.modelName]
      .find(query)
      .then(entities => {
        if (entities == null) {
          entities = []
        }
        async.mapSeries(
          entities,
          (entity, cb) => entity.fetchV1Data(cb),
          callback
        )
      })
      .catch(callback)
  },
}

UserMembershipsHandler.promises = promisifyAll(UserMembershipsHandler)
export default UserMembershipsHandler
