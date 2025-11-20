import logger from '@overleaf/logger'
import util from 'node:util'
import { AffiliationError } from '../Errors/Errors.js'
import Features from '../../infrastructure/Features.mjs'
import { User } from '../../models/User.mjs'
import UserDeleter from './UserDeleter.mjs'
import UserGetter from './UserGetter.mjs'
import UserUpdater from './UserUpdater.mjs'
import Analytics from '../Analytics/AnalyticsManager.mjs'
import UserOnboardingEmailManager from './UserOnboardingEmailManager.mjs'
import UserPostRegistrationAnalyticsManager from './UserPostRegistrationAnalyticsManager.mjs'
import OError from '@overleaf/o-error'

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
      OError.tag(error, 'could not get fresh user data', {
        userId: user._id,
        email: user.email,
      })
    )
  }
  return user
}

async function recordRegistrationEvent(user) {
  try {
    const segmentation = {
      'home-registration': 'default',
    }
    if (user.thirdPartyIdentifiers && user.thirdPartyIdentifiers.length > 0) {
      segmentation.provider = user.thirdPartyIdentifiers[0].providerId
    }
    Analytics.recordEventForUserInBackground(
      user._id,
      'user-registered',
      segmentation
    )
  } catch (err) {
    logger.warn({ err }, 'there was an error recording `user-registered` event')
  }
}

async function createNewUser(attributes, options = {}) {
  let user = new User()

  if (attributes.first_name == null || attributes.first_name === '') {
    attributes.first_name = attributes.email.split('@')[0]
  }

  Object.assign(user, attributes)

  user.ace.syntaxValidation = true

  const reversedHostname = user.email.split('@')[1].split('').reverse().join('')

  const emailData = {
    email: user.email,
    createdAt: new Date(),
    reversedHostname,
  }
  if (Features.hasFeature('affiliations') && !options.requireAffiliation) {
    emailData.affiliationUnchecked = true
  }
  if (
    attributes.samlIdentifiers &&
    attributes.samlIdentifiers[0] &&
    attributes.samlIdentifiers[0].providerId
  ) {
    emailData.samlProviderId = attributes.samlIdentifiers[0].providerId
  }

  const affiliationOptions = options.affiliationOptions || {}

  if (options.confirmedAt) {
    emailData.confirmedAt = options.confirmedAt
    affiliationOptions.confirmedAt = options.confirmedAt
  }
  user.emails = [emailData]

  user = await user.save()

  if (Features.hasFeature('affiliations')) {
    try {
      user = await _addAffiliation(user, affiliationOptions)
    } catch (error) {
      if (options.requireAffiliation) {
        await UserDeleter.promises.deleteMongoUser(user._id)
        throw OError.tag(error)
      } else {
        const err = OError.tag(error, 'adding affiliations failed')
        logger.error({ err, userId: user._id }, err.message)
      }
    }
  }

  await recordRegistrationEvent(user)
  await Analytics.setUserPropertyForUser(user._id, 'created-at', new Date())
  await Analytics.setUserPropertyForUser(user._id, 'user-id', user._id)
  if (attributes.analyticsId) {
    await Analytics.setUserPropertyForUser(
      user._id,
      'analytics-id',
      attributes.analyticsId
    )
  }

  if (Features.hasFeature('saas')) {
    try {
      await UserOnboardingEmailManager.scheduleOnboardingEmail(user)
      await UserPostRegistrationAnalyticsManager.schedulePostRegistrationAnalytics(
        user
      )
    } catch (error) {
      logger.error(
        OError.tag(error, 'Failed to schedule sending of onboarding email', {
          userId: user._id,
        })
      )
    }
  }

  return user
}

const UserCreator = {
  createNewUser: util.callbackify(createNewUser),
  promises: {
    createNewUser,
  },
}

export default UserCreator
