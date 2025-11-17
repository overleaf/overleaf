import mongodb from 'mongodb-legacy'
import EmailHandler from '../Email/EmailHandler.mjs'
import Errors from '../Errors/Errors.js'
import InstitutionsAPI from '../Institutions/InstitutionsAPI.mjs'
import NotificationsBuilder from '../Notifications/NotificationsBuilder.mjs'
import OError from '@overleaf/o-error'
import SubscriptionLocator from '../Subscription/SubscriptionLocator.mjs'
import UserAuditLogHandler from '../User/UserAuditLogHandler.mjs'
import UserGetter from '../User/UserGetter.mjs'
import UserUpdater from '../User/UserUpdater.mjs'
import logger from '@overleaf/logger'
import { User } from '../../models/User.mjs'
import { promiseMapWithLimit } from '@overleaf/promise-utils'

const { ObjectId } = mongodb

async function _addAuditLogEntry(operation, userId, auditLog, extraInfo) {
  await UserAuditLogHandler.promises.addEntry(
    userId,
    operation,
    auditLog.initiatorId,
    auditLog.ipAddress,
    extraInfo
  )
}

async function _ensureCanAddIdentifier(userId, institutionEmail, providerId) {
  const userWithProvider = await UserGetter.promises.getUser(
    { _id: new ObjectId(userId), 'samlIdentifiers.providerId': providerId },
    { _id: 1 }
  )

  if (userWithProvider) {
    throw new Errors.SAMLAlreadyLinkedError()
  }

  const userWithEmail =
    await UserGetter.promises.getUserByAnyEmail(institutionEmail)

  if (!userWithEmail) {
    // email doesn't exist; all good
    return
  }

  const emailBelongToUser = userWithEmail._id.toString() === userId.toString()
  const existingEmailData = userWithEmail.emails.find(
    emailData => emailData.email === institutionEmail
  )

  if (!emailBelongToUser && existingEmailData.samlProviderId) {
    // email exists and institution link.
    // Return back to requesting page with error
    throw new Errors.SAMLIdentityExistsError()
  }

  if (!emailBelongToUser) {
    // email exists but not linked, so redirect to linking page
    // which will tell this user to log out to link
    throw new Errors.EmailExistsError()
  }

  // email belongs to user. Make sure it's already affiliated with the provider
  const fullEmails = await UserGetter.promises.getUserFullEmails(
    userWithEmail._id
  )
  const existingFullEmailData = fullEmails.find(
    emailData => emailData.email === institutionEmail
  )

  if (!existingFullEmailData.affiliation) {
    throw new Errors.SAMLEmailNotAffiliatedError()
  }

  if (
    existingFullEmailData.affiliation.institution.id.toString() !== providerId
  ) {
    throw new Errors.SAMLEmailAffiliatedWithAnotherInstitutionError()
  }
}

async function _addIdentifier(
  userId,
  externalUserId,
  providerId,
  hasEntitlement,
  institutionEmail,
  providerName,
  auditLog,
  userIdAttribute
) {
  providerId = providerId.toString()

  await _ensureCanAddIdentifier(userId, institutionEmail, providerId)

  const auditLogInfo = {
    institutionEmail,
    providerId,
    providerName,
    userIdAttribute,
    externalUserId,
  }

  await _addAuditLogEntry(
    'link-institution-sso',
    userId,
    auditLog,
    auditLogInfo
  )

  hasEntitlement = !!hasEntitlement
  const query = {
    _id: userId,
    'samlIdentifiers.providerId': {
      $ne: providerId,
    },
  }

  const update = {
    $push: {
      samlIdentifiers: {
        hasEntitlement,
        externalUserId,
        providerId,
        userIdAttribute,
      },
    },
  }

  try {
    // update v2 user record
    const updatedUser = await User.findOneAndUpdate(query, update, {
      new: true,
    }).exec()
    if (!updatedUser) {
      throw new OError('No update while linking user')
    }
    return updatedUser
  } catch (err) {
    if (err.code === 11000) {
      throw new Errors.SAMLIdentityExistsError()
    } else {
      throw OError.tag(err)
    }
  }
}

async function _addInstitutionEmail(userId, email, providerId, auditLog) {
  const user = await UserGetter.promises.getUser(userId)
  const query = {
    _id: userId,
    'emails.email': email,
  }
  const update = {
    $set: {
      'emails.$.samlProviderId': providerId.toString(),
    },
  }
  if (user == null) {
    throw new Errors.NotFoundError('user not found')
  }
  const emailAlreadyAssociated = user.emails.find(e => e.email === email)
  if (emailAlreadyAssociated) {
    await UserUpdater.promises.updateUser(query, update)
  } else {
    await UserUpdater.promises.addEmailAddress(
      user._id,
      email,
      { university: { id: providerId }, rejectIfBlocklisted: true },
      auditLog
    )
    await UserUpdater.promises.updateUser(query, update)
  }
}

async function _sendLinkedEmail(userId, providerName, institutionEmail) {
  const user = await UserGetter.promises.getUser(userId, { email: 1 })
  const emailOptions = {
    to: user.email,
    actionDescribed: `an Institutional SSO account at ${providerName} was linked to your account ${user.email}`,
    action: 'institutional SSO account linked',
    message: [
      `<span style="display:inline-block;padding: 0 20px;width:100%;">Linked: <br/><b>${institutionEmail}</b></span>`,
    ],
  }
  EmailHandler.sendEmail('securityAlert', emailOptions, error => {
    if (error) {
      logger.warn({ err: error })
    }
  })
}

function _sendUnlinkedEmail(primaryEmail, providerName, institutionEmail) {
  const emailOptions = {
    to: primaryEmail,
    actionDescribed: `an Institutional SSO account at ${providerName} was unlinked from your account ${primaryEmail}`,
    action: 'institutional SSO account no longer linked',
    message: [
      `<span style="display:inline-block;padding: 0 20px;width:100%;">No longer linked: <br/><b>${institutionEmail}</b></span>`,
    ],
  }
  EmailHandler.sendEmail('securityAlert', emailOptions, error => {
    if (error) {
      logger.warn({ err: error })
    }
  })
}

async function getUser(providerId, externalUserId, userIdAttribute) {
  if (!providerId || !externalUserId || !userIdAttribute) {
    throw new Error(
      `invalid arguments: providerId: ${providerId}, externalUserId: ${externalUserId}, userIdAttribute: ${userIdAttribute}`
    )
  }
  const user = await User.findOne({
    samlIdentifiers: {
      $elemMatch: {
        externalUserId: externalUserId.toString(),
        providerId: providerId.toString(),
        userIdAttribute: userIdAttribute.toString(),
      },
    },
  }).exec()

  return user
}

async function redundantSubscription(userId, providerId, providerName) {
  const subscription =
    await SubscriptionLocator.promises.getUserIndividualSubscription(userId)

  if (subscription && !subscription.groupPlan) {
    await NotificationsBuilder.promises
      .redundantPersonalSubscription(
        {
          institutionId: providerId,
          institutionName: providerName,
        },
        { _id: userId }
      )
      .create()
  }
}

async function linkAccounts(userId, samlData, auditLog) {
  const {
    externalUserId,
    institutionEmail,
    universityId: providerId,
    universityName: providerName,
    hasEntitlement,
    userIdAttribute,
  } = samlData

  if (!externalUserId || !institutionEmail || !providerId || !userIdAttribute) {
    throw new Error(
      `missing data when linking institution SSO: ${JSON.stringify(samlData)}`
    )
  }

  await _addIdentifier(
    userId,
    externalUserId,
    providerId,
    hasEntitlement,
    institutionEmail,
    providerName,
    auditLog,
    userIdAttribute
  )
  try {
    await _addInstitutionEmail(userId, institutionEmail, providerId, auditLog)
  } catch (error) {
    await _removeIdentifier(userId, providerId)
    throw error
  }
  await UserUpdater.promises.confirmEmail(userId, institutionEmail, {
    entitlement: hasEntitlement,
  }) // will set confirmedAt if not set, and will always update reconfirmedAt
  await _sendLinkedEmail(userId, providerName, institutionEmail)
}

async function unlinkAccounts(
  userId,
  institutionEmail,
  primaryEmail,
  providerId,
  providerName,
  auditLog
) {
  providerId = providerId.toString()

  await _addAuditLogEntry('unlink-institution-sso', userId, auditLog, {
    institutionEmail,
    providerId,
    providerName,
  })
  // update v2 user
  await _removeIdentifier(userId, providerId)
  // update v1 affiliations record
  await InstitutionsAPI.promises.removeEntitlement(userId, institutionEmail)
  // send email
  _sendUnlinkedEmail(primaryEmail, providerName, institutionEmail)
}

async function _removeIdentifier(userId, providerId) {
  providerId = providerId.toString()

  const query = {
    _id: userId,
  }
  const update = {
    $pull: {
      samlIdentifiers: {
        providerId,
      },
    },
  }
  await User.updateOne(query, update).exec()
}

async function updateEntitlement(
  userId,
  institutionEmail,
  providerId,
  hasEntitlement
) {
  providerId = providerId.toString()
  hasEntitlement = !!hasEntitlement
  const query = {
    _id: userId,
    'samlIdentifiers.providerId': providerId.toString(),
  }
  const update = {
    $set: {
      'samlIdentifiers.$.hasEntitlement': hasEntitlement,
    },
  }
  // update v2 user
  await User.updateOne(query, update).exec()
}

function entitlementAttributeMatches(entitlementAttribute, entitlementMatcher) {
  if (Array.isArray(entitlementAttribute)) {
    entitlementAttribute = entitlementAttribute.join(' ')
  }
  if (
    typeof entitlementAttribute !== 'string' ||
    typeof entitlementMatcher !== 'string'
  ) {
    return false
  }
  try {
    const entitlementRegExp = new RegExp(entitlementMatcher)
    return !!entitlementAttribute.match(entitlementRegExp)
  } catch (err) {
    logger.error({ err }, 'Invalid SAML entitlement matcher')
    // this is likely caused by an invalid regex in the matcher string
    // log the error but do not bubble so that user can still sign in
    // even if they don't have the entitlement
    return false
  }
}

function userHasEntitlement(user, providerId) {
  providerId = providerId.toString()
  if (!user || !Array.isArray(user.samlIdentifiers)) {
    return false
  }
  for (const samlIdentifier of user.samlIdentifiers) {
    if (providerId && samlIdentifier.providerId !== providerId) {
      continue
    }
    if (samlIdentifier.hasEntitlement) {
      return true
    }
  }
  return false
}

async function migrateIdentifier(
  userId,
  externalUserId,
  providerId,
  hasEntitlement,
  institutionEmail,
  providerName,
  auditLog,
  userIdAttribute
) {
  providerId = providerId.toString()

  const query = {
    _id: userId,
    'samlIdentifiers.providerId': providerId,
  }

  const update = {
    $set: {
      'samlIdentifiers.$.externalUserId': externalUserId,
      'samlIdentifiers.$.userIdAttribute': userIdAttribute,
    },
  }
  await User.updateOne(query, update).exec()

  const auditLogInfo = {
    institutionEmail,
    providerId,
    providerName,
    userIdAttribute,
  }

  await _addAuditLogEntry(
    'migrate-institution-sso-id',
    userId,
    auditLog,
    auditLogInfo
  )
}

async function unlinkNotMigrated(userId, providerId, providerName, auditLog) {
  providerId = providerId.toString()

  const query = {
    _id: userId,
    'emails.samlProviderId': providerId,
  }
  const update = {
    $pull: {
      samlIdentifiers: {
        providerId,
      },
    },
    $unset: {
      'emails.$.samlProviderId': 1,
    },
  }

  const originalDoc = await User.findOneAndUpdate(query, update).exec()

  // should only be 1
  const linkedEmails = originalDoc.emails.filter(email => {
    return email.samlProviderId === providerId
  })

  const auditLogInfo = {
    providerId,
    providerName,
  }

  await _addAuditLogEntry(
    'unlink-institution-sso-not-migrated',
    userId,
    auditLog,
    auditLogInfo
  )

  await promiseMapWithLimit(10, linkedEmails, async emailData => {
    await InstitutionsAPI.promises.removeEntitlement(userId, emailData.email)
  })
}

const SAMLIdentityManager = {
  entitlementAttributeMatches,
  getUser,
  linkAccounts,
  migrateIdentifier,
  redundantSubscription,
  unlinkAccounts,
  unlinkNotMigrated,
  updateEntitlement,
  userHasEntitlement,
}

export default SAMLIdentityManager
