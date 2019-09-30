const Errors = require('../Errors/Errors')
const logger = require('logger-sharelatex')
const OError = require('@overleaf/o-error')
const { User } = require('../../models/User')
const UserGetter = require('../User/UserGetter')
const UserUpdater = require('../User/UserUpdater')

function _addIdentifier(userId, externalUserId, providerId) {
  providerId = providerId.toString()
  const query = {
    _id: userId,
    'samlIdentifiers.providerId': {
      $ne: providerId
    }
  }
  const update = {
    $push: {
      samlIdentifiers: {
        externalUserId,
        providerId
      }
    }
  }

  // First update user.samlIdentifiers
  let updatedUser = User.findOneAndUpdate(query, update, { new: true }).exec()
  try {
    updatedUser = User.findOneAndUpdate(query, update, { new: true }).exec()
  } catch (err) {
    if (err && err.code === 11000) {
      throw new Errors.SAMLIdentityExistsError()
    } else if (err != null) {
      logger.log(err, userId, 'failed to add institution SAML identifier')
      throw new OError(err)
    }
  }
  return updatedUser
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
    logger.log(userId, 'could not find user for institution SAML linking')
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

async function getUser(providerId, externalUserId) {
  if (providerId == null || externalUserId == null) {
    throw new Error('invalid arguments')
  }
  try {
    const query = _getUserQuery(providerId, externalUserId)
    let user = await User.findOne(query).exec()
    if (!user) {
      throw new Errors.SAMLUserNotFoundError()
    }
    return user
  } catch (error) {
    throw error
  }
}

async function linkAccounts(
  userId,
  externalUserId,
  institutionEmail,
  providerId
) {
  try {
    await _addIdentifier(userId, externalUserId, providerId)
    await _addInstitutionEmail(userId, institutionEmail, providerId)
  } catch (error) {
    throw error
  }
}

const SAMLIdentityManager = {
  getUser,
  linkAccounts
}

module.exports = SAMLIdentityManager
