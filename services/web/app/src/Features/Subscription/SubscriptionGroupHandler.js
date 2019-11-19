/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const async = require('async')
const _ = require('underscore')
const { promisify } = require('util')
const SubscriptionUpdater = require('./SubscriptionUpdater')
const SubscriptionLocator = require('./SubscriptionLocator')
const UserGetter = require('../User/UserGetter')
const { Subscription } = require('../../models/Subscription')
const LimitationsManager = require('./LimitationsManager')
const logger = require('logger-sharelatex')
const OneTimeTokenHandler = require('../Security/OneTimeTokenHandler')
const EmailHandler = require('../Email/EmailHandler')
const settings = require('settings-sharelatex')
const NotificationsBuilder = require('../Notifications/NotificationsBuilder')
const UserMembershipViewModel = require('../UserMembership/UserMembershipViewModel')

const SubscriptionGroupHandler = {
  removeUserFromGroup(subscriptionId, userToRemove_id, callback) {
    return SubscriptionUpdater.removeUserFromGroup(
      subscriptionId,
      userToRemove_id,
      callback
    )
  },

  replaceUserReferencesInGroups(oldId, newId, callback) {
    return Subscription.update(
      { admin_id: oldId },
      { admin_id: newId },
      function(error) {
        if (error != null) {
          return callback(error)
        }

        return replaceInArray(
          Subscription,
          'manager_ids',
          oldId,
          newId,
          function(error) {
            if (error != null) {
              return callback(error)
            }

            return replaceInArray(
              Subscription,
              'member_ids',
              oldId,
              newId,
              callback
            )
          }
        )
      }
    )
  },

  isUserPartOfGroup(user_id, subscription_id, callback) {
    if (callback == null) {
      callback = function(err, partOfGroup) {}
    }
    return SubscriptionLocator.getSubscriptionByMemberIdAndId(
      user_id,
      subscription_id,
      function(err, subscription) {
        let partOfGroup
        if (subscription != null) {
          partOfGroup = true
        } else {
          partOfGroup = false
        }
        return callback(err, partOfGroup)
      }
    )
  },

  getTotalConfirmedUsersInGroup(subscription_id, callback) {
    if (callback == null) {
      callback = function(err, totalUsers) {}
    }
    return SubscriptionLocator.getSubscription(
      subscription_id,
      (err, subscription) =>
        callback(
          err,
          __guard__(
            subscription != null ? subscription.member_ids : undefined,
            x => x.length
          )
        )
    )
  }
}

var replaceInArray = function(model, property, oldValue, newValue, callback) {
  // Mongo won't let us pull and addToSet in the same query, so do it in
  // two. Note we need to add first, since the query is based on the old user.
  const query = {}
  query[property] = oldValue

  const setNewValue = {}
  setNewValue[property] = newValue

  const setOldValue = {}
  setOldValue[property] = oldValue

  return model.update(
    query,
    { $addToSet: setNewValue },
    { multi: true },
    function(error) {
      if (error != null) {
        return callback(error)
      }
      return model.update(
        query,
        { $pull: setOldValue },
        { multi: true },
        callback
      )
    }
  )
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}

SubscriptionGroupHandler.promises = {
  getTotalConfirmedUsersInGroup: promisify(
    SubscriptionGroupHandler.getTotalConfirmedUsersInGroup
  ),
  isUserPartOfGroup: promisify(SubscriptionGroupHandler.isUserPartOfGroup)
}

module.exports = SubscriptionGroupHandler
