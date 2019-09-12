const Errors = require('../Errors/Errors')
const logger = require('logger-sharelatex')
const OError = require('@overleaf/o-error')
const { User } = require('../../models/User')
const UserGetter = require('../User/UserGetter')
const UserUpdater = require('../User/UserUpdater')

function _addIdentifier(userId, externalUserId, providerId) {
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

async function _addInstitutionEmail(userId, email) {
  const user = await UserGetter.promises.getUser(userId)
  if (user == null) {
    logger.log(userId, 'could not find user for institution SAML linking')
    throw new Errors.NotFoundError('user not found')
  }
  const emailAlreadyAssociated = user.emails.find(e => e.email === email)
  if (emailAlreadyAssociated && emailAlreadyAssociated.confirmedAt) {
    // nothing to do, email is already added and confirmed
  } else if (emailAlreadyAssociated) {
    // add and confirm email
    await _confirmEmail(user._id, email)
  } else {
    // add and confirm email
    await _addEmail(user._id, email)
    await _confirmEmail(user._id, email)
  }
}

function _addEmail(userId, institutionEmail) {
  return new Promise((resolve, reject) => {
    UserUpdater.addEmailAddress(userId, institutionEmail, function(
      error,
      addEmailResult
    ) {
      if (error) {
        logger.log(
          error,
          userId,
          'could not add institution email after SAML linking'
        )
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

function _confirmEmail(userId, institutionEmail) {
  return new Promise((resolve, reject) => {
    UserUpdater.confirmEmail(userId, institutionEmail, function(
      error,
      confirmedResult
    ) {
      if (error) {
        logger.log(
          error,
          userId,
          'could not confirm institution email after SAML linking'
        )
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

async function getUser(providerId, externalUserId) {
  if (providerId == null || externalUserId == null) {
    throw new Error('invalid arguments')
  }
  try {
    const query = SAMLIdentityManager._getUserQuery(providerId, externalUserId)
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
  await _addIdentifier(userId, externalUserId, providerId)
  await _addInstitutionEmail(userId, institutionEmail)
}

const SAMLIdentityManager = {
  _getUserQuery(providerId, externalUserId) {
    externalUserId = externalUserId.toString()
    providerId = providerId.toString()
    const query = {
      'samlIdentifiers.externalUserId': externalUserId,
      'samlIdentifiers.providerId': providerId
    }
    return query
  },
  getUser,
  linkAccounts
}

module.exports = SAMLIdentityManager
