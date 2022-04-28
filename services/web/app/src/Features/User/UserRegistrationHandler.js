const { User } = require('../../models/User')
const UserCreator = require('./UserCreator')
const UserGetter = require('./UserGetter')
const AuthenticationManager = require('../Authentication/AuthenticationManager')
const NewsletterManager = require('../Newsletter/NewsletterManager')
const async = require('async')
const logger = require('@overleaf/logger')
const crypto = require('crypto')
const EmailHandler = require('../Email/EmailHandler')
const OneTimeTokenHandler = require('../Security/OneTimeTokenHandler')
const settings = require('@overleaf/settings')
const EmailHelper = require('../Helpers/EmailHelper')

const UserRegistrationHandler = {
  _registrationRequestIsValid(body) {
    const invalidEmail = AuthenticationManager.validateEmail(body.email || '')
    const invalidPassword = AuthenticationManager.validatePassword(
      body.password || '',
      body.email
    )
    return !(invalidEmail || invalidPassword)
  },

  _createNewUserIfRequired(user, userDetails, callback) {
    if (!user) {
      userDetails.holdingAccount = false
      UserCreator.createNewUser(
        {
          holdingAccount: false,
          email: userDetails.email,
          first_name: userDetails.first_name,
          last_name: userDetails.last_name,
          analyticsId: userDetails.analyticsId,
        },
        {},
        callback
      )
    } else {
      callback(null, user)
    }
  },

  registerNewUser(userDetails, callback) {
    const self = this
    const requestIsValid = this._registrationRequestIsValid(userDetails)
    if (!requestIsValid) {
      return callback(new Error('request is not valid'))
    }
    userDetails.email = EmailHelper.parseEmail(userDetails.email)
    UserGetter.getUserByAnyEmail(userDetails.email, (error, user) => {
      if (error) {
        return callback(error)
      }
      if (user && user.holdingAccount === false) {
        return callback(new Error('EmailAlreadyRegistered'), user)
      }
      self._createNewUserIfRequired(user, userDetails, (error, user) => {
        if (error) {
          return callback(error)
        }
        async.series(
          [
            callback =>
              User.updateOne(
                { _id: user._id },
                { $set: { holdingAccount: false } },
                callback
              ),
            callback =>
              AuthenticationManager.setUserPassword(
                user,
                userDetails.password,
                callback
              ),
            callback => {
              if (userDetails.subscribeToNewsletter === 'true') {
                NewsletterManager.subscribe(user, error => {
                  if (error) {
                    logger.warn(
                      { err: error, user },
                      'Failed to subscribe user to newsletter'
                    )
                  }
                })
              }
              callback()
            }, // this can be slow, just fire it off
          ],
          error => {
            callback(error, user)
          }
        )
      })
    })
  },

  registerNewUserAndSendActivationEmail(email, callback) {
    UserRegistrationHandler.registerNewUser(
      {
        email,
        password: crypto.randomBytes(32).toString('hex'),
      },
      (error, user) => {
        if (error && error.message !== 'EmailAlreadyRegistered') {
          return callback(error)
        }

        if (error && error.message === 'EmailAlreadyRegistered') {
          logger.log({ email }, 'user already exists, resending welcome email')
        }

        const ONE_WEEK = 7 * 24 * 60 * 60 // seconds
        OneTimeTokenHandler.getNewToken(
          'password',
          { user_id: user._id.toString(), email: user.email },
          { expiresIn: ONE_WEEK },
          (error, token) => {
            if (error) {
              return callback(error)
            }

            const setNewPasswordUrl = `${settings.siteUrl}/user/activate?token=${token}&user_id=${user._id}`

            EmailHandler.sendEmail(
              'registered',
              {
                to: user.email,
                setNewPasswordUrl,
              },
              error => {
                if (error) {
                  logger.warn({ err: error }, 'failed to send activation email')
                }
                callback(null, user, setNewPasswordUrl)
              }
            )
          }
        )
      }
    )
  },
}

module.exports = UserRegistrationHandler
