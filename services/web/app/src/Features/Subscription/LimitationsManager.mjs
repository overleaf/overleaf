// @ts-check

import logger from '@overleaf/logger'

import ProjectGetter from '../Project/ProjectGetter.mjs'
import UserGetter from '../User/UserGetter.mjs'
import SubscriptionLocator from './SubscriptionLocator.mjs'
import Settings from '@overleaf/settings'
import CollaboratorsGetter from '../Collaborators/CollaboratorsGetter.mjs'
import CollaboratorsInvitesGetter from '../Collaborators/CollaboratorsInviteGetter.mjs'
import PrivilegeLevels from '../Authorization/PrivilegeLevels.mjs'
import { callbackify, callbackifyMultiResult } from '@overleaf/promise-utils'

async function allowedNumberOfCollaboratorsInProject(projectId) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    owner_ref: true,
  })
  return await allowedNumberOfCollaboratorsForUser(project.owner_ref)
}

async function allowedNumberOfCollaboratorsForUser(userId) {
  const user = await UserGetter.promises.getUser(userId, { features: 1 })
  if (user.features && user.features.collaborators) {
    return user.features.collaborators
  } else {
    return Settings.defaultFeatures.collaborators
  }
}

async function canAcceptEditCollaboratorInvite(projectId) {
  const allowedNumber = await allowedNumberOfCollaboratorsInProject(projectId)
  if (allowedNumber < 0) {
    return true // -1 means unlimited
  }
  const currentEditors =
    await CollaboratorsGetter.promises.getInvitedEditCollaboratorCount(
      projectId
    )
  return currentEditors + 1 <= allowedNumber
}

async function canAddXEditCollaborators(
  projectId,
  numberOfNewEditCollaborators
) {
  const allowedNumber = await allowedNumberOfCollaboratorsInProject(projectId)
  if (allowedNumber < 0) {
    return true // -1 means unlimited
  }
  const currentEditors =
    await CollaboratorsGetter.promises.getInvitedEditCollaboratorCount(
      projectId
    )
  const editInviteCount =
    await CollaboratorsInvitesGetter.promises.getEditInviteCount(projectId)
  return (
    currentEditors + editInviteCount + numberOfNewEditCollaborators <=
    allowedNumber
  )
}

/**
 * Check whether a collaborator can be switched to the given privilege level
 *
 * @param {string} projectId
 * @param {string} userId
 * @param {'readOnly' | 'review' | 'readAndWrite'} privilegeLevel
 * @return {Promise<boolean>}
 */
async function canChangeCollaboratorPrivilegeLevel(
  projectId,
  userId,
  privilegeLevel
) {
  if (privilegeLevel === PrivilegeLevels.READ_ONLY) {
    return true
  }

  const currentPrivilegeLevel =
    await CollaboratorsGetter.promises.getMemberIdPrivilegeLevel(
      userId,
      projectId
    )
  if (
    currentPrivilegeLevel === PrivilegeLevels.READ_AND_WRITE ||
    currentPrivilegeLevel === PrivilegeLevels.REVIEW
  ) {
    // Current collaborator already takes a slot, so changing the privilege
    // level won't increase the collaborator count
    return true
  }

  const allowedNumber = await allowedNumberOfCollaboratorsInProject(projectId)
  if (allowedNumber < 0) {
    // -1 means unlimited
    return true
  }

  const slotsTaken =
    await CollaboratorsGetter.promises.getInvitedEditCollaboratorCount(
      projectId
    )
  const inviteCount =
    await CollaboratorsInvitesGetter.promises.getEditInviteCount(projectId)

  return slotsTaken + inviteCount < allowedNumber
}

async function hasPaidSubscription(user) {
  const { hasSubscription, subscription } = await userHasSubscription(user)
  const { isMember } = await userIsMemberOfGroupSubscription(user)
  return {
    hasPaidSubscription: hasSubscription || isMember,
    subscription,
  }
}

// alias for backward-compatibility with modules. Use `haspaidsubscription` instead
async function userHasSubscriptionOrIsGroupMember(user) {
  return await hasPaidSubscription(user)
}

async function userHasSubscription(user) {
  const subscription = await SubscriptionLocator.promises.getUsersSubscription(
    user._id
  )
  let hasValidSubscription = false
  if (subscription) {
    if (
      subscription.recurlySubscription_id ||
      subscription.paymentProvider?.subscriptionId ||
      subscription.customAccount
    ) {
      hasValidSubscription = true
    }
  }
  return {
    hasSubscription: hasValidSubscription,
    subscription,
  }
}

async function userIsMemberOfGroupSubscription(user) {
  const subscriptions =
    (await SubscriptionLocator.promises.getMemberSubscriptions(user._id)) || []
  return { isMember: subscriptions.length > 0, subscriptions }
}

function teamHasReachedMemberLimit(subscription) {
  const currentTotal =
    (subscription.member_ids || []).length +
    (subscription.teamInvites || []).length +
    (subscription.invited_emails || []).length

  return currentTotal >= subscription.membersLimit
}

async function hasGroupMembersLimitReached(subscriptionId, callback) {
  const subscription =
    await SubscriptionLocator.promises.getSubscription(subscriptionId)
  if (!subscription) {
    logger.warn({ subscriptionId }, 'no subscription found')
    throw new Error('no subscription found')
  }
  const limitReached = teamHasReachedMemberLimit(subscription)
  return { limitReached, subscription }
}

const LimitationsManager = {
  allowedNumberOfCollaboratorsInProject: callbackify(
    allowedNumberOfCollaboratorsInProject
  ),
  allowedNumberOfCollaboratorsForUser: callbackify(
    allowedNumberOfCollaboratorsForUser
  ),
  canAddXEditCollaborators: callbackify(canAddXEditCollaborators),
  canChangeCollaboratorPrivilegeLevel: callbackify(
    canChangeCollaboratorPrivilegeLevel
  ),
  hasPaidSubscription: callbackifyMultiResult(hasPaidSubscription, [
    'hasPaidSubscription',
    'subscription',
  ]),
  userHasSubscriptionOrIsGroupMember: callbackifyMultiResult(
    userHasSubscriptionOrIsGroupMember,
    ['hasPaidSubscription', 'subscription']
  ),
  userHasSubscription: callbackifyMultiResult(userHasSubscription, [
    'hasSubscription',
    'subscription',
  ]),
  userIsMemberOfGroupSubscription: callbackifyMultiResult(
    userIsMemberOfGroupSubscription,
    ['isMember', 'subscriptions']
  ),
  hasGroupMembersLimitReached: callbackifyMultiResult(
    hasGroupMembersLimitReached,
    ['limitReached', 'subscription']
  ),

  teamHasReachedMemberLimit,

  promises: {
    allowedNumberOfCollaboratorsInProject,
    allowedNumberOfCollaboratorsForUser,
    canAcceptEditCollaboratorInvite,
    canAddXEditCollaborators,
    canChangeCollaboratorPrivilegeLevel,
    hasPaidSubscription,
    userHasSubscriptionOrIsGroupMember,
    userHasSubscription,
    userIsMemberOfGroupSubscription,
    hasGroupMembersLimitReached,
  },
}

export default LimitationsManager
