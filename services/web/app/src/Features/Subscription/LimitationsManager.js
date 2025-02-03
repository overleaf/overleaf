const logger = require('@overleaf/logger')
const ProjectGetter = require('../Project/ProjectGetter')
const UserGetter = require('../User/UserGetter')
const SubscriptionLocator = require('./SubscriptionLocator')
const Settings = require('@overleaf/settings')
const CollaboratorsGetter = require('../Collaborators/CollaboratorsGetter')
const CollaboratorsInvitesGetter = require('../Collaborators/CollaboratorsInviteGetter')
const {
  callbackify,
  callbackifyMultiResult,
} = require('@overleaf/promise-utils')

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
    if (subscription.recurlySubscription_id || subscription.customAccount) {
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
    hasPaidSubscription,
    userHasSubscriptionOrIsGroupMember,
    userHasSubscription,
    userIsMemberOfGroupSubscription,
    hasGroupMembersLimitReached,
  },
}

module.exports = LimitationsManager
