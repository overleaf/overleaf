const { promisify } = require('util')
const SubscriptionUpdater = require('./SubscriptionUpdater')
const SubscriptionLocator = require('./SubscriptionLocator')
const { Subscription } = require('../../models/Subscription')

const SubscriptionGroupHandler = {
  removeUserFromGroup(subscriptionId, userIdToRemove, callback) {
    SubscriptionUpdater.removeUserFromGroup(
      subscriptionId,
      userIdToRemove,
      callback
    )
  },

  replaceUserReferencesInGroups(oldId, newId, callback) {
    Subscription.updateOne(
      { admin_id: oldId },
      { admin_id: newId },
      function (error) {
        if (error) {
          return callback(error)
        }

        replaceInArray(
          Subscription,
          'manager_ids',
          oldId,
          newId,
          function (error) {
            if (error) {
              return callback(error)
            }

            replaceInArray(Subscription, 'member_ids', oldId, newId, callback)
          }
        )
      }
    )
  },

  isUserPartOfGroup(userId, subscriptionId, callback) {
    SubscriptionLocator.getSubscriptionByMemberIdAndId(
      userId,
      subscriptionId,
      function (err, subscription) {
        let partOfGroup
        if (subscription) {
          partOfGroup = true
        } else {
          partOfGroup = false
        }
        callback(err, partOfGroup)
      }
    )
  },

  getTotalConfirmedUsersInGroup(subscriptionId, callback) {
    SubscriptionLocator.getSubscription(subscriptionId, (err, subscription) =>
      callback(err, subscription?.member_ids?.length)
    )
  },
}

function replaceInArray(model, property, oldValue, newValue, callback) {
  // Mongo won't let us pull and addToSet in the same query, so do it in
  // two. Note we need to add first, since the query is based on the old user.
  const query = {}
  query[property] = oldValue

  const setNewValue = {}
  setNewValue[property] = newValue

  const setOldValue = {}
  setOldValue[property] = oldValue

  model.updateMany(query, { $addToSet: setNewValue }, function (error) {
    if (error) {
      return callback(error)
    }
    model.updateMany(query, { $pull: setOldValue }, callback)
  })
}

SubscriptionGroupHandler.promises = {
  getTotalConfirmedUsersInGroup: promisify(
    SubscriptionGroupHandler.getTotalConfirmedUsersInGroup
  ),
  isUserPartOfGroup: promisify(SubscriptionGroupHandler.isUserPartOfGroup),
}

module.exports = SubscriptionGroupHandler
