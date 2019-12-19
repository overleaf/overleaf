const EmailHandler = require('../Email/EmailHandler')
const Errors = require('../Errors/Errors')
const InstitutionsAPI = require('../Institutions/InstitutionsAPI')
const OError = require('@overleaf/o-error')
const UserGetter = require('../User/UserGetter')
const UserUpdater = require('../User/UserUpdater')
const logger = require('logger-sharelatex')
const { User } = require('../../models/User')

async function _addIdentifier(
  userId,
  externalUserId,
  providerId,
  hasEntitlement,
  institutionEmail
) {
  // first check if institutionEmail linked to another account
  // before adding the identifier for the email
  const user = await UserGetter.promises.getUserByAnyEmail(institutionEmail)
  if (user && user._id.toString() !== userId.toString()) {
    const existingEmailData = user.emails.find(
      emailData => emailData.email === institutionEmail
    )
    if (existingEmailData && existingEmailData.samlProviderId) {
      // email exists and institution link.
      // Return back to requesting page with error
      throw new Errors.SAMLIdentityExistsError()
    } else {
      // Only email exists but not linked, so redirect to linking page
      // which will tell this user to log out to link
      throw new Errors.EmailExistsError()
    }
  }
  providerId = providerId.toString()
  hasEntitlement = !!hasEntitlement
  const query = {
    _id: userId,
    'samlIdentifiers.providerId': {
      $ne: providerId
    }
  }
  const update = {
    $push: {
      samlIdentifiers: {
        hasEntitlement,
        externalUserId,
        providerId
      }
    }
  }
  try {
    // update v2 user record
    const updatedUser = User.findOneAndUpdate(query, update, {
      new: true
    }).exec()
    return updatedUser
  } catch (err) {
    if (err.code === 11000) {
      throw new Errors.SAMLIdentityExistsError()
    } else {
      throw new OError(err)
    }
  }
}

function _getUserQuery(providerId, externalUserId) {
  externalUserId = externalUserId.toString()
  providerId = providerId.toString()
  const query = {
    'samlIdentifiers.externalUserId': externalUserId,
    'samlIdentifiers.providerId': providerId
  }
  return query
}

async function _addInstitutionEmail(userId, email, providerId) {
  const user = await UserGetter.promises.getUser(userId)
  const query = {
    _id: userId,
    'emails.email': email
  }
  const update = {
    $set: {
      'emails.$.samlProviderId': providerId.toString()
    }
  }
  if (user == null) {
    throw new Errors.NotFoundError('user not found')
  }
  const emailAlreadyAssociated = user.emails.find(e => e.email === email)
  if (emailAlreadyAssociated && emailAlreadyAssociated.confirmedAt) {
    await UserUpdater.promises.updateUser(query, update)
  } else if (emailAlreadyAssociated) {
    // add and confirm email
    await UserUpdater.promises.confirmEmail(user._id, email)
    await UserUpdater.promises.updateUser(query, update)
  } else {
    // add and confirm email
    await UserUpdater.promises.addEmailAddress(user._id, email)
    await UserUpdater.promises.confirmEmail(user._id, email)
    await UserUpdater.promises.updateUser(query, update)
  }
}

async function _sendLinkedEmail(userId, providerName) {
  const user = await UserGetter.promises.getUser(userId, { email: 1 })
  const emailOptions = {
    to: user.email,
    provider: providerName
  }
  EmailHandler.sendEmail(
    'emailThirdPartyIdentifierLinked',
    emailOptions,
    error => {
      if (error != null) {
        logger.warn(error)
      }
    }
  )
}

function _sendUnlinkedEmail(primaryEmail, providerName) {
  const emailOptions = {
    to: primaryEmail,
    provider: providerName
  }
  EmailHandler.sendEmail(
    'emailThirdPartyIdentifierUnlinked',
    emailOptions,
    error => {
      if (error != null) {
        logger.warn(error)
      }
    }
  )
}

async function getUser(providerId, externalUserId) {
  if (providerId == null || externalUserId == null) {
    throw new Error(
      `invalid arguments: providerId: ${providerId}, externalUserId: ${externalUserId}`
    )
  }
  providerId = providerId.toString()
  externalUserId = externalUserId.toString()
  const query = _getUserQuery(providerId, externalUserId)
  let user = await User.findOne(query).exec()
  if (!user) {
    throw new Errors.SAMLUserNotFoundError()
  }
  return user
}

async function linkAccounts(
  userId,
  externalUserId,
  institutionEmail,
  providerId,
  providerName,
  hasEntitlement
) {
  await _addIdentifier(
    userId,
    externalUserId,
    providerId,
    hasEntitlement,
    institutionEmail
  )
  await _addInstitutionEmail(userId, institutionEmail, providerId)
  await _sendLinkedEmail(userId, providerName)
  // update v1 affiliations record
  if (hasEntitlement) {
    await InstitutionsAPI.promises.addEntitlement(userId, institutionEmail)
  }
}

async function unlinkAccounts(
  userId,
  institutionEmail,
  primaryEmail,
  providerId,
  providerName
) {
  providerId = providerId.toString()
  const query = {
    _id: userId
  }
  const update = {
    $pull: {
      samlIdentifiers: {
        providerId
      }
    }
  }
  // update v2 user
  await User.update(query, update).exec()
  // update v1 affiliations record
  await InstitutionsAPI.promises.removeEntitlement(userId, institutionEmail)
  // send email
  _sendUnlinkedEmail(primaryEmail, providerName)
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
    'samlIdentifiers.providerId': providerId.toString()
  }
  const update = {
    $set: {
      'samlIdentifiers.$.hasEntitlement': hasEntitlement
    }
  }
  // update v2 user
  await User.update(query, update).exec()
  // update v1 affiliations record
  if (hasEntitlement) {
    await InstitutionsAPI.promises.addEntitlement(userId, institutionEmail)
  } else {
    await InstitutionsAPI.promises.removeEntitlement(userId, institutionEmail)
  }
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

const SAMLIdentityManager = {
  entitlementAttributeMatches,
  getUser,
  linkAccounts,
  unlinkAccounts,
  updateEntitlement,
  userHasEntitlement
}

module.exports = SAMLIdentityManager
