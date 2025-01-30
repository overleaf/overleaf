const { callbackifyAll } = require('@overleaf/promise-utils')
const { Subscription } = require('../../models/Subscription')
const { DeletedSubscription } = require('../../models/DeletedSubscription')
const logger = require('@overleaf/logger')
require('./GroupPlansData') // make sure dynamic group plans are loaded

const SubscriptionLocator = {
  async getUsersSubscription(userOrId) {
    const userId = SubscriptionLocator._getUserId(userOrId)
    const subscription = await Subscription.findOne({ admin_id: userId }).exec()
    logger.debug({ userId }, 'got users subscription')
    return subscription
  },

  async getUserIndividualSubscription(userOrId) {
    const userId = SubscriptionLocator._getUserId(userOrId)
    const subscription = await Subscription.findOne({
      admin_id: userId,
      groupPlan: false,
    }).exec()
    logger.debug({ userId }, 'got users individual subscription')
    return subscription
  },

  async getManagedGroupSubscriptions(userOrId) {
    return await Subscription.find({
      manager_ids: userOrId,
      groupPlan: true,
    })
      .populate('admin_id', ['_id', 'email'])
      .exec()
  },

  async getMemberSubscriptions(userOrId, populate = []) {
    const userId = SubscriptionLocator._getUserId(userOrId)
    // eslint-disable-next-line no-restricted-syntax
    return await Subscription.find({ member_ids: userId })
      .populate('admin_id', 'email')
      .populate(populate)
      .exec()
  },

  async getAdminEmail(subscriptionId) {
    const subscription = await Subscription.findById(subscriptionId)
      .populate('admin_id', 'email')
      .exec()

    return subscription?.admin_id?.email
  },

  async getAdminEmailAndName(subscriptionId) {
    const subscription = await Subscription.findById(subscriptionId)
      .populate('admin_id', ['email', 'first_name', 'last_name'])
      .exec()

    return subscription?.admin_id
  },

  async hasRecurlyGroupSubscription(userOrId) {
    const userId = SubscriptionLocator._getUserId(userOrId)
    return await Subscription.exists({
      groupPlan: true,
      recurlySubscription_id: { $exists: true },
      $or: [
        { member_ids: userId },
        { manager_ids: userId },
        { admin_id: userId },
      ],
    }).exec()
  },

  async getSubscription(subscriptionId) {
    return await Subscription.findOne({ _id: subscriptionId }).exec()
  },

  async getSubscriptionByMemberIdAndId(userId, subscriptionId) {
    return await Subscription.findOne(
      { member_ids: userId, _id: subscriptionId },
      { _id: 1 }
    ).exec()
  },

  async getGroupSubscriptionsMemberOf(userId) {
    return await Subscription.find(
      { member_ids: userId },
      { _id: 1, planCode: 1 }
    )
  },

  async getGroupsWithEmailInvite(email) {
    return await Subscription.find({ invited_emails: email }).exec()
  },

  async getGroupsWithTeamInvitesEmail(email) {
    return await Subscription.find(
      { teamInvites: { $elemMatch: { email } } },
      { teamInvites: 1 }
    ).exec()
  },

  async getGroupWithV1Id(v1TeamId) {
    return await Subscription.findOne({ 'overleaf.id': v1TeamId }).exec()
  },

  async getUserDeletedSubscriptions(userId) {
    return await DeletedSubscription.find({
      'subscription.admin_id': userId,
    }).exec()
  },

  async getDeletedSubscription(subscriptionId) {
    return await DeletedSubscription.findOne({
      'subscription._id': subscriptionId,
    }).exec()
  },

  _getUserId(userOrId) {
    if (userOrId && userOrId._id) {
      return userOrId._id
    } else if (userOrId) {
      return userOrId
    }
  },
}

module.exports = {
  ...callbackifyAll(SubscriptionLocator),
  promises: SubscriptionLocator,
}
