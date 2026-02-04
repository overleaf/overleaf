/**
 * @import { AddOn } from '../../../../types/subscription/plan'
 */

import { callbackifyAll } from '@overleaf/promise-utils'

import { Subscription } from '../../models/Subscription.mjs'
import SubscriptionHelper from './SubscriptionHelper.mjs'
import { DeletedSubscription } from '../../models/DeletedSubscription.mjs'
import logger from '@overleaf/logger'
import { AI_ADD_ON_CODE, isStandaloneAiAddOnPlanCode } from './AiHelper.mjs'
import './GroupPlansData.mjs' // make sure dynamic group plans are loaded
import Features from '../../infrastructure/Features.mjs'

const SubscriptionLocator = {
  async getUsersSubscription(userOrId) {
    if (!Features.hasFeature('saas')) return undefined
    const userId = SubscriptionLocator._getUserId(userOrId)
    const subscription = await Subscription.findOne({ admin_id: userId }).exec()
    logger.debug({ userId }, 'got users subscription')

    if (subscription) {
      return await SubscriptionHelper.recomputeSubscriptionState(subscription)
    }

    return subscription
  },

  async getUserIndividualSubscription(userOrId) {
    if (!Features.hasFeature('saas')) return undefined
    const userId = SubscriptionLocator._getUserId(userOrId)
    const subscription = await Subscription.findOne({
      admin_id: userId,
      groupPlan: false,
    }).exec()
    logger.debug({ userId }, 'got users individual subscription')
    return subscription
  },

  async getManagedGroupSubscriptions(userOrId) {
    if (!Features.hasFeature('saas')) return []
    return await Subscription.find({
      manager_ids: userOrId,
      groupPlan: true,
    })
      .populate('admin_id', ['_id', 'email'])
      .exec()
  },

  async getMemberSubscriptions(userOrId, populate = []) {
    if (!Features.hasFeature('saas')) return []
    const userId = SubscriptionLocator._getUserId(userOrId)
    // eslint-disable-next-line no-restricted-syntax
    return await Subscription.find({ member_ids: userId })
      .populate('admin_id', 'email')
      .populate(populate)
      .exec()
  },

  async getAdminEmail(subscriptionId) {
    if (!Features.hasFeature('saas')) return undefined
    const subscription = await Subscription.findById(subscriptionId)
      .populate('admin_id', 'email')
      .exec()

    return subscription?.admin_id?.email
  },

  async getAdminEmailAndName(subscriptionId) {
    if (!Features.hasFeature('saas')) return undefined
    const subscription = await Subscription.findById(subscriptionId)
      .populate('admin_id', ['email', 'first_name', 'last_name'])
      .exec()

    return subscription?.admin_id
  },

  async hasRecurlyGroupSubscription(userOrId) {
    if (!Features.hasFeature('saas')) return false
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
    if (!Features.hasFeature('saas')) return []
    return await Subscription.find(
      { member_ids: userId },
      { _id: 1, planCode: 1, userFeaturesDisabled: 1 }
    )
  },

  async getUniqueManagedSubscriptionMemberOf(userId) {
    if (!Features.hasFeature('saas')) return null
    return await Subscription.findOne(
      { member_ids: userId, managedUsersEnabled: true },
      { _id: 1 }
    )
  },

  async getUniqueManagedSubscriptionUserAssociation(userId) {
    return await Subscription.findOne(
      {
        managedUsersEnabled: true,
        $or: [
          { member_ids: userId },
          { manager_ids: userId },
          { admin_id: userId },
        ],
      },
      { _id: 1 }
    )
  },

  async getGroupsWithEmailInvite(email) {
    return await Subscription.find({ invited_emails: email }).exec()
  },

  async getGroupsWithTeamInvitesEmail(email) {
    if (!Features.hasFeature('saas')) return []
    return await Subscription.find(
      {
        teamInvites: { $elemMatch: { email } },
        // Add partialFilterExpression from index.
        'teamInvites.email': { $exists: true },
      },
      { teamInvites: 1 }
    ).exec()
  },

  async getGroupWithV1Id(v1TeamId) {
    return await Subscription.findOne({ 'overleaf.id': v1TeamId }).exec()
  },

  async getUserDeletedSubscriptions(userId) {
    if (!Features.hasFeature('saas')) return []
    return await DeletedSubscription.find({
      'subscription.admin_id': userId,
    }).exec()
  },

  async getDeletedSubscription(subscriptionId) {
    return await DeletedSubscription.findOne({
      'subscription._id': subscriptionId,
    }).exec()
  },

  async hasAiAssist(userOrId) {
    const userId = SubscriptionLocator._getUserId(userOrId)
    const subscription = await Subscription.findOne({ admin_id: userId }).exec()
    // todo: as opposed to recurlyEntities which use addon.code, subscription model uses addon.addOnCode
    //  which we hope to align via https://github.com/overleaf/internal/issues/25494
    return Boolean(
      (subscription?.planCode &&
        isStandaloneAiAddOnPlanCode(subscription?.planCode)) ||
      subscription?.addOns?.some(addOn => addOn.addOnCode === AI_ADD_ON_CODE)
    )
  },

  _getUserId(userOrId) {
    if (userOrId && userOrId._id) {
      return userOrId._id
    } else if (userOrId) {
      return userOrId
    }
  },

  /**
   * Retrieves the last successful subscription for a given user.
   *
   * @async
   * @function
   * @param {string} recurlyId - The ID of the recurly subscription tied to the mongo subscription to check for a previous successful state.
   * @returns {Promise<{_id: ObjectId, planCode: string, addOns: [AddOn]}|null>} A promise that resolves to the last successful planCode and addon state,
   *   or null if we havent stored a previous
   */
  async getLastSuccessfulSubscription(recurlyId) {
    const subscription = await Subscription.findOne({
      recurlySubscription_id: recurlyId,
    }).exec()
    return subscription && subscription.lastSuccesfulSubscription
      ? {
          ...subscription.lastSuccesfulSubscription,
          _id: subscription._id,
        }
      : null
  },

  async getUserSubscriptionStatus(userId) {
    let usersSubscription = { personal: false, group: false }

    if (!userId) {
      return usersSubscription
    }

    const memberSubscriptions =
      await SubscriptionLocator.getMemberSubscriptions(userId)

    const hasActiveGroupSubscription = memberSubscriptions.some(
      subscription =>
        subscription.groupPlan &&
        SubscriptionHelper.getPaidSubscriptionState(subscription) === 'active'
    )
    if (hasActiveGroupSubscription) {
      // Member of a group plan
      usersSubscription = { ...usersSubscription, group: true }
    }

    const personalSubscription =
      await SubscriptionLocator.getUsersSubscription(userId)

    if (personalSubscription) {
      const hasActivePersonalSubscription =
        SubscriptionHelper.getPaidSubscriptionState(personalSubscription) ===
        'active'
      if (hasActivePersonalSubscription) {
        if (personalSubscription.groupPlan) {
          // Owner of a group plan
          usersSubscription = { ...usersSubscription, group: true }
        } else {
          // Owner of an individual plan
          usersSubscription = { ...usersSubscription, personal: true }
        }
      }
    }

    return usersSubscription
  },
}

export default {
  ...callbackifyAll(SubscriptionLocator),
  promises: SubscriptionLocator,
}
