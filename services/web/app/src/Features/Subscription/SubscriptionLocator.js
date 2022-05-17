const { promisify } = require('util')
const { Subscription } = require('../../models/Subscription')
const { DeletedSubscription } = require('../../models/DeletedSubscription')
const logger = require('@overleaf/logger')
require('./GroupPlansData') // make sure dynamic group plans are loaded

const SubscriptionLocator = {
  getUsersSubscription(userOrId, callback) {
    const userId = SubscriptionLocator._getUserId(userOrId)
    Subscription.findOne({ admin_id: userId }, function (err, subscription) {
      logger.debug({ userId }, 'got users subscription')
      callback(err, subscription)
    })
  },

  getUserIndividualSubscription(userOrId, callback) {
    const userId = SubscriptionLocator._getUserId(userOrId)
    Subscription.findOne(
      { admin_id: userId, groupPlan: false },
      function (err, subscription) {
        logger.debug({ userId }, 'got users individual subscription')
        callback(err, subscription)
      }
    )
  },

  getManagedGroupSubscriptions(userOrId, callback) {
    Subscription.find({
      manager_ids: userOrId,
      groupPlan: true,
    })
      .populate('admin_id')
      .exec(callback)
  },

  getMemberSubscriptions(userOrId, callback) {
    const userId = SubscriptionLocator._getUserId(userOrId)
    Subscription.find({ member_ids: userId })
      .populate('admin_id')
      .exec(callback)
  },

  getSubscription(subscriptionId, callback) {
    Subscription.findOne({ _id: subscriptionId }, callback)
  },

  getSubscriptionByMemberIdAndId(userId, subscriptionId, callback) {
    Subscription.findOne(
      { member_ids: userId, _id: subscriptionId },
      { _id: 1 },
      callback
    )
  },

  getGroupSubscriptionsMemberOf(userId, callback) {
    Subscription.find({ member_ids: userId }, { _id: 1, planCode: 1 }, callback)
  },

  getGroupsWithEmailInvite(email, callback) {
    Subscription.find({ invited_emails: email }, callback)
  },

  getGroupWithV1Id(v1TeamId, callback) {
    Subscription.findOne({ 'overleaf.id': v1TeamId }, callback)
  },

  getUserDeletedSubscriptions(userId, callback) {
    DeletedSubscription.find({ 'subscription.admin_id': userId }, callback)
  },

  getDeletedSubscription(subscriptionId, callback) {
    DeletedSubscription.findOne(
      {
        'subscription._id': subscriptionId,
      },
      callback
    )
  },

  _getUserId(userOrId) {
    if (userOrId && userOrId._id) {
      return userOrId._id
    } else if (userOrId) {
      return userOrId
    }
  },
}

SubscriptionLocator.promises = {
  getUsersSubscription: promisify(SubscriptionLocator.getUsersSubscription),
  getUserIndividualSubscription: promisify(
    SubscriptionLocator.getUserIndividualSubscription
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
  getDeletedSubscription: promisify(SubscriptionLocator.getDeletedSubscription),
}
module.exports = SubscriptionLocator
