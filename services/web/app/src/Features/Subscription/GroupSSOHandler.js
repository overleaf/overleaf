const { SSOConfig } = require('../../models/SSOConfig')
const UserAuditLogHandler = require('../User/UserAuditLogHandler')
const UserUpdater = require('../User/UserUpdater')
const SAMLIdentityManager = require('../User/SAMLIdentityManager')
const { User } = require('../../models/User')
const Errors = require('../Errors/Errors')
const GroupUtils = require('./GroupUtils')

async function checkUserCanEnrollInSubscription(userId, subscription) {
  const ssoConfig = await SSOConfig.findById(subscription?.ssoConfig).exec()
  if (!ssoConfig?.enabled) {
    throw new Errors.SAMLGroupSSODisabledError()
  }

  const userIsMember = subscription.member_ids.some(
    memberId => memberId.toString() === userId.toString()
  )
  if (!userIsMember) {
    throw new Errors.SAMLGroupSSOLoginIdentityNotFoundError()
  }

  const user = await User.findOne({ _id: userId }, { enrollment: 1 }).exec()

  const userIsEnrolled = user.enrollment?.sso?.some(
    enrollment => enrollment.groupId.toString() === subscription._id.toString()
  )
  if (userIsEnrolled) {
    throw new Errors.SAMLIdentityExistsError()
  }
}

async function enrollInSubscription(
  userId,
  subscription,
  externalUserId,
  userIdAttribute,
  auditLog
) {
  await checkUserCanEnrollInSubscription(userId, subscription)

  const providerId = GroupUtils.getProviderId(subscription._id)

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

module.exports = {
  promises: {
    checkUserCanEnrollInSubscription,
    enrollInSubscription,
  },
}
