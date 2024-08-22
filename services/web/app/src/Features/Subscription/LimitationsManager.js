const logger = require('@overleaf/logger')
const ProjectGetter = require('../Project/ProjectGetter')
const UserGetter = require('../User/UserGetter')
const SubscriptionLocator = require('./SubscriptionLocator')
const Settings = require('@overleaf/settings')
const CollaboratorsGetter = require('../Collaborators/CollaboratorsGetter')
const CollaboratorsInvitesGetter = require('../Collaborators/CollaboratorsInviteGetter')
const V1SubscriptionManager = require('./V1SubscriptionManager')
const { V1ConnectionError } = require('../Errors/Errors')
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

async function canAddXCollaborators(projectId, numberOfNewCollaborators) {
  const allowedNumber = await allowedNumberOfCollaboratorsInProject(projectId)
  if (allowedNumber < 0) {
    return true // -1 means unlimited
  }
  const currentNumber =
    await CollaboratorsGetter.promises.getInvitedCollaboratorCount(projectId)
  const inviteCount =
    await CollaboratorsInvitesGetter.promises.getInviteCount(projectId)
  return currentNumber + inviteCount + numberOfNewCollaborators <= allowedNumber
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
  const { hasSubscription, subscription } = await userHasV2Subscription(user)
  const { isMember } = await userIsMemberOfGroupSubscription(user)
  try {
    const hasV1Subscription = await userHasV1Subscription(user)
    return {
      hasPaidSubscription: hasSubscription || isMember || hasV1Subscription,
      subscription,
    }
  } catch (err) {
    throw new V1ConnectionError('error getting subscription from v1').withCause(
      err
    )
  }
}

// alias for backward-compatibility with modules. Use `haspaidsubscription` instead
async function userHasSubscriptionOrIsGroupMember(user) {
  return await hasPaidSubscription(user)
}

async function userHasV2Subscription(user) {
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

async function userHasV1OrV2Subscription(user) {
  const { hasSubscription: hasV2Subscription } =
    await userHasV2Subscription(user)
  if (hasV2Subscription) {
    return true
  }
  const hasV1Subscription = await userHasV1Subscription(user)
  if (hasV1Subscription) {
    return true
  }
  return false
}

async function userIsMemberOfGroupSubscription(user) {
  const subscriptions =
    (await SubscriptionLocator.promises.getMemberSubscriptions(user._id)) || []
  return { isMember: subscriptions.length > 0, subscriptions }
}

async function userHasV1Subscription(user, callback) {
  const v1Subscription =
    await V1SubscriptionManager.promises.getSubscriptionsFromV1(user._id)
  return !!(v1Subscription ? v1Subscription.has_subscription : undefined)
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
  canAddXCollaborators: callbackify(canAddXCollaborators),
  canAddXEditCollaborators: callbackify(canAddXEditCollaborators),
  hasPaidSubscription: callbackifyMultiResult(hasPaidSubscription, [
    'hasPaidSubscription',
    'subscription',
  ]),
  userHasSubscriptionOrIsGroupMember: callbackifyMultiResult(
    userHasSubscriptionOrIsGroupMember,
    ['hasPaidSubscription', 'subscription']
  ),
  userHasV2Subscription: callbackifyMultiResult(userHasV2Subscription, [
    'hasSubscription',
    'subscription',
  ]),
  userHasV1OrV2Subscription: callbackify(userHasV1OrV2Subscription),
  userIsMemberOfGroupSubscription: callbackifyMultiResult(
    userIsMemberOfGroupSubscription,
    ['isMember', 'subscriptions']
  ),
  userHasV1Subscription: callbackify(userHasV1Subscription),
  hasGroupMembersLimitReached: callbackifyMultiResult(
    hasGroupMembersLimitReached,
    ['limitReached', 'subscription']
  ),

  teamHasReachedMemberLimit,

  promises: {
    allowedNumberOfCollaboratorsInProject,
    allowedNumberOfCollaboratorsForUser,
    canAcceptEditCollaboratorInvite,
    canAddXCollaborators,
    canAddXEditCollaborators,
    hasPaidSubscription,
    userHasSubscriptionOrIsGroupMember,
    userHasV2Subscription,
    userHasV1OrV2Subscription,
    userIsMemberOfGroupSubscription,
    userHasV1Subscription,
    hasGroupMembersLimitReached,
  },
}

module.exports = LimitationsManager
