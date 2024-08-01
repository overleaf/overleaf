const { User } = require('../../models/User')
const UserCreator = require('./UserCreator')
const UserGetter = require('./UserGetter')
const AuthenticationManager = require('../Authentication/AuthenticationManager')
const NewsletterManager = require('../Newsletter/NewsletterManager')
const logger = require('@overleaf/logger')
const crypto = require('crypto')
const EmailHandler = require('../Email/EmailHandler')
const OneTimeTokenHandler = require('../Security/OneTimeTokenHandler')
const settings = require('@overleaf/settings')
const EmailHelper = require('../Helpers/EmailHelper')
const {
  callbackify,
  callbackifyMultiResult,
} = require('@overleaf/promise-utils')
const OError = require('@overleaf/o-error')

const UserRegistrationHandler = {
  _registrationRequestIsValid(body) {
    const invalidEmail = AuthenticationManager.validateEmail(body.email || '')
    const invalidPassword = AuthenticationManager.validatePassword(
      body.password || '',
      body.email
    )
    return !(invalidEmail || invalidPassword)
  },

  async _createNewUserIfRequired(user, userDetails) {
    if (!user) {
      userDetails.holdingAccount = false
      return await UserCreator.promises.createNewUser(
        {
          holdingAccount: false,
          email: userDetails.email,
          first_name: userDetails.first_name,
          last_name: userDetails.last_name,
          analyticsId: userDetails.analyticsId,
        },
        {}
      )
    }
    return user
  },

  async registerNewUser(userDetails) {
    const requestIsValid =
      UserRegistrationHandler._registrationRequestIsValid(userDetails)

    if (!requestIsValid) {
      throw new Error('request is not valid')
    }
    userDetails.email = EmailHelper.parseEmail(userDetails.email)

    let user = await UserGetter.promises.getUserByAnyEmail(userDetails.email)
    if (user && user.holdingAccount === false) {
      // We add userId to the error object so that the calling function can access
      // the id of the already existing user account.
      throw new OError('EmailAlreadyRegistered', { userId: user._id })
    }

    user = await UserRegistrationHandler._createNewUserIfRequired(
      user,
      userDetails
    )

    await User.updateOne(
      { _id: user._id },
      { $set: { holdingAccount: false } }
    ).exec()

    await AuthenticationManager.promises.setUserPassword(
      user,
      userDetails.password
    )

    if (userDetails.subscribeToNewsletter === 'true') {
      try {
        NewsletterManager.subscribe(user)
      } catch (error) {
        logger.warn(
          { err: error, user },
          'Failed to subscribe user to newsletter'
        )
        throw error
      }
    }

    return user
  },

  async registerNewUserAndSendActivationEmail(email) {
    let user
    try {
      user = await UserRegistrationHandler.registerNewUser({
        email,
        password: crypto.randomBytes(32).toString('hex'),
      })
    } catch (error) {
      if (error.message === 'EmailAlreadyRegistered') {
        logger.debug({ email }, 'user already exists, resending welcome email')
        user = await UserGetter.promises.getUserByAnyEmail(email)
      } else {
        throw error
      }
    }

    const ONE_WEEK = 7 * 24 * 60 * 60 // seconds
    const token = await OneTimeTokenHandler.promises.getNewToken(
      'password',
      { user_id: user._id.toString(), email: user.email },
      { expiresIn: ONE_WEEK }
    )

    const setNewPasswordUrl = `${settings.siteUrl}/user/activate?token=${token}&user_id=${user._id}`

    await EmailHandler.promises
      .sendEmail('registered', {
        to: user.email,
        setNewPasswordUrl,
      })
      .catch(error => {
        logger.warn({ err: error }, 'failed to send activation email')
      })

    return { user, setNewPasswordUrl }
  },
}

module.exports = {
  registerNewUser: callbackify(UserRegistrationHandler.registerNewUser),
  registerNewUserAndSendActivationEmail: callbackifyMultiResult(
    UserRegistrationHandler.registerNewUserAndSendActivationEmail,
    ['user', 'setNewPasswordUrl']
  ),
  promises: UserRegistrationHandler,
}
