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
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { promisify } = require('util')
const { Subscription } = require('../../models/Subscription')
const { DeletedSubscription } = require('../../models/DeletedSubscription')
const logger = require('logger-sharelatex')
const { ObjectId } = require('mongoose').Types

const SubscriptionLocator = {
  getUsersSubscription(user_or_id, callback) {
    const user_id = SubscriptionLocator._getUserId(user_or_id)
    logger.log({ user_id }, 'getting users subscription')
    return Subscription.findOne({ admin_id: user_id }, function(
      err,
      subscription
    ) {
      logger.log({ user_id }, 'got users subscription')
      return callback(err, subscription)
    })
  },

  findManagedSubscription(managerId, callback) {
    logger.log({ managerId }, 'finding managed subscription')
    return Subscription.findOne({ manager_ids: managerId }, callback)
  },

  getManagedGroupSubscriptions(user_or_id, callback) {
    if (callback == null) {
      callback = function(error, managedSubscriptions) {}
    }
    const user_id = SubscriptionLocator._getUserId(user_or_id)
    return Subscription.find({
      manager_ids: user_or_id,
      groupPlan: true
    })
      .populate('admin_id')
      .exec(callback)
  },

  getMemberSubscriptions(user_or_id, callback) {
    const user_id = SubscriptionLocator._getUserId(user_or_id)
    logger.log({ user_id }, 'getting users group subscriptions')
    return Subscription.find({ member_ids: user_id })
      .populate('admin_id')
      .exec(callback)
  },

  getSubscription(subscription_id, callback) {
    return Subscription.findOne({ _id: subscription_id }, callback)
  },

  getSubscriptionByMemberIdAndId(user_id, subscription_id, callback) {
    return Subscription.findOne(
      { member_ids: user_id, _id: subscription_id },
      { _id: 1 },
      callback
    )
  },

  getGroupSubscriptionsMemberOf(user_id, callback) {
    return Subscription.find(
      { member_ids: user_id },
      { _id: 1, planCode: 1 },
      callback
    )
  },

  getGroupsWithEmailInvite(email, callback) {
    return Subscription.find({ invited_emails: email }, callback)
  },

  getGroupWithV1Id(v1TeamId, callback) {
    return Subscription.findOne({ 'overleaf.id': v1TeamId }, callback)
  },

  getUserDeletedSubscriptions(userId, callback) {
    logger.log({ userId }, 'getting users deleted subscriptions')
    DeletedSubscription.find({ 'subscription.admin_id': userId }, callback)
  },

  getDeletedSubscription(subscriptionId, callback) {
    DeletedSubscription.findOne(
      {
        'subscription._id': subscriptionId
      },
      callback
    )
  },

  _getUserId(user_or_id) {
    if (user_or_id != null && user_or_id._id != null) {
      return user_or_id._id
    } else if (user_or_id != null) {
      return user_or_id
    }
  }
}

SubscriptionLocator.promises = {
  getUsersSubscription: promisify(SubscriptionLocator.getUsersSubscription),
  findManagedSubscription: promisify(
    SubscriptionLocator.findManagedSubscription
  ),
  getManagedGroupSubscriptions: promisify(
    SubscriptionLocator.getManagedGroupSubscriptions
  ),
  getMemberSubscriptions: promisify(SubscriptionLocator.getMemberSubscriptions),
  getSubscription: promisify(SubscriptionLocator.getSubscription),
  getSubscriptionByMemberIdAndId: promisify(
    SubscriptionLocator.getSubscriptionByMemberIdAndId
  ),
  getGroupSubscriptionsMemberOf: promisify(
    SubscriptionLocator.getGroupSubscriptionsMemberOf
  ),
  getGroupsWithEmailInvite: promisify(
    SubscriptionLocator.getGroupsWithEmailInvite
  ),
  getGroupWithV1Id: promisify(SubscriptionLocator.getGroupWithV1Id),
  getUserDeletedSubscriptions: promisify(
    SubscriptionLocator.getUserDeletedSubscriptions
  ),
  getDeletedSubscription: promisify(SubscriptionLocator.getDeletedSubscription)
}
module.exports = SubscriptionLocator
