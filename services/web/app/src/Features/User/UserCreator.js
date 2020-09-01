const logger = require('logger-sharelatex')
const util = require('util')
const { AffiliationError } = require('../Errors/Errors')
const Features = require('../../infrastructure/Features')
const { User } = require('../../models/User')
const UserDeleter = require('./UserDeleter')
const UserGetter = require('./UserGetter')
const UserUpdater = require('./UserUpdater')

async function _addAffiliation(user, affiliationOptions) {
  try {
    await UserUpdater.promises.addAffiliationForNewUser(
      user._id,
      user.email,
      affiliationOptions
    )
  } catch (error) {
    throw new AffiliationError('add affiliation failed').withCause(error)
  }

  try {
    user = await UserGetter.promises.getUser(user._id)
  } catch (error) {
    logger.error(
      { userId: user._id, email: user.email },
      'could not get fresh user data'
    )
  }
  return user
}

async function createNewUser(attributes, options = {}) {
  let user = new User()

  if (attributes.first_name == null || attributes.first_name === '') {
    attributes.first_name = attributes.email.split('@')[0]
  }

  Object.assign(user, attributes)

  user.ace.syntaxValidation = true
  if (user.featureSwitches != null) {
    user.featureSwitches.pdfng = true
  }

  const reversedHostname = user.email
    .split('@')[1]
    .split('')
    .reverse()
    .join('')

  const emailData = {
    email: user.email,
    createdAt: new Date(),
    reversedHostname
  }
  if (Features.hasFeature('affiliations')) {
    emailData.affiliationUnchecked = true
  }
  if (
    attributes.samlIdentifiers &&
    attributes.samlIdentifiers[0] &&
    attributes.samlIdentifiers[0].providerId
  ) {
    emailData.samlProviderId = attributes.samlIdentifiers[0].providerId
  }

  user.emails = [emailData]

  user = await user.save()

  if (Features.hasFeature('affiliations')) {
    try {
      user = await _addAffiliation(user, options.affiliationOptions || {})
    } catch (error) {
      if (options.requireAffiliation) {
        await UserDeleter.promises.deleteMongoUser(user._id)
        throw error
      } else {
        logger.error(error)
      }
    }
  }

  return user
}

const UserCreator = {
  createNewUser: util.callbackify(createNewUser),
  promises: {
    createNewUser: createNewUser
  }
}

module.exports = UserCreator
