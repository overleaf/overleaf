const { SSOConfig } = require('../../models/SSOConfig')
const UserAuditLogHandler = require('../User/UserAuditLogHandler')
const UserUpdater = require('../User/UserUpdater')
const SAMLIdentityManager = require('../User/SAMLIdentityManager')
const { User } = require('../../models/User')
const Errors = require('../Errors/Errors')

async function canEnrollInSubscription(userId, subscription) {
  const ssoEnabled = await isSSOEnabled(subscription)
  if (!ssoEnabled) {
    return false
  }

  const userIsMember = subscription.member_ids.some(
    memberId => memberId.toString() === userId.toString()
  )
  if (!userIsMember) {
    return false
  }

  const user = await User.findOne(
    { _id: userId },
    { projection: { enrollment: 1 } }
  ).exec()

  const userIsEnrolled = user.enrollment?.sso?.some(
    enrollment => enrollment.groupId.toString() === subscription._id.toString()
  )
  if (userIsEnrolled) {
    return false
  }
  return true
}

async function enrollInSubscription(
  userId,
  subscription,
  externalUserId,
  userIdAttribute,
  auditLog
) {
  const canEnroll = await canEnrollInSubscription(userId, subscription)
  if (!canEnroll) {
    throw new Errors.SubscriptionNotFoundError(
      'cannot enroll user in SSO subscription',
      {
        info: { userId, subscription },
      }
    )
  }
  const providerId = `ol-group-subscription-id:${subscription._id.toString()}`

  const userBySamlIdentifier = await SAMLIdentityManager.getUser(
    providerId,
    externalUserId,
    userIdAttribute
  )

  if (userBySamlIdentifier) {
    throw new Errors.SAMLIdentityExistsError()
  }

  const samlIdentifiers = {
    externalUserId,
    userIdAttribute,
    providerId,
  }

  await UserUpdater.promises.updateUser(userId, {
    $push: {
      samlIdentifiers,
      'enrollment.sso': {
        groupId: subscription._id,
        linkedAt: new Date(),
        primary: true,
      },
    },
  })

  await UserAuditLogHandler.promises.addEntry(
    userId,
    'group-sso-link',
    auditLog.initiatorId,
    auditLog.ipAddress,
    samlIdentifiers
  )
}

async function isSSOEnabled(subscription) {
  const ssoConfig = await SSOConfig.findById(subscription.ssoConfig).exec()
  return ssoConfig?.enabled
}

module.exports = {
  promises: {
    canEnrollInSubscription,
    enrollInSubscription,
    isSSOEnabled,
  },
}
