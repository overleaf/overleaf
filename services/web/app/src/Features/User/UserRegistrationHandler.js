const { User } = require('../../models/User')
const UserCreator = require('./UserCreator')
const UserGetter = require('./UserGetter')
const AuthenticationManager = require('../Authentication/AuthenticationManager')
const NewsletterManager = require('../Newsletter/NewsletterManager')
const async = require('async')
const logger = require('logger-sharelatex')
const crypto = require('crypto')
const EmailHandler = require('../Email/EmailHandler')
const OneTimeTokenHandler = require('../Security/OneTimeTokenHandler')
const Analytics = require('../Analytics/AnalyticsManager')
const settings = require('settings-sharelatex')
const EmailHelper = require('../Helpers/EmailHelper')

const UserRegistrationHandler = {
  _registrationRequestIsValid(body, callback) {
    const invalidEmail = AuthenticationManager.validateEmail(body.email || '')
    const invalidPassword = AuthenticationManager.validatePassword(
      body.password || ''
    )
    if (invalidEmail != null || invalidPassword != null) {
      return false
    } else {
      return true
    }
  },

  _createNewUserIfRequired(user, userDetails, callback) {
    if (user == null) {
      userDetails.holdingAccount = false
      UserCreator.createNewUser(
        {
          holdingAccount: false,
          email: userDetails.email,
          first_name: userDetails.first_name,
          last_name: userDetails.last_name
        },
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
    UserGetter.getUserByAnyEmail(userDetails.email, (err, user) => {
      if (err != null) {
        return callback(err)
      }
      if ((user != null ? user.holdingAccount : undefined) === false) {
        return callback(new Error('EmailAlreadyRegistered'), user)
      }
      self._createNewUserIfRequired(user, userDetails, (err, user) => {
        if (err != null) {
          return callback(err)
        }
        async.series(
          [
            cb =>
              User.update(
                { _id: user._id },
                { $set: { holdingAccount: false } },
                cb
              ),
            cb =>
              AuthenticationManager.setUserPassword(
                user._id,
                userDetails.password,
                cb
              ),
            cb => {
              if (userDetails.subscribeToNewsletter === 'true') {
                NewsletterManager.subscribe(user, err => {
                  if (err != null) {
                    logger.warn(
                      { err, user },
                      'Failed to subscribe user to newsletter'
                    )
                  }
                })
              }
              cb()
            } // this can be slow, just fire it off
          ],
          err => {
            logger.log({ user }, 'registered')
            Analytics.recordEvent(user._id, 'user-registered')
            callback(err, user)
          }
        )
      })
    })
  },

  registerNewUserAndSendActivationEmail(email, callback) {
    logger.log({ email }, 'registering new user')
    UserRegistrationHandler.registerNewUser(
      {
        email,
        password: crypto.randomBytes(32).toString('hex')
      },
      (err, user) => {
        if (
          err != null &&
          (err != null ? err.message : undefined) !== 'EmailAlreadyRegistered'
        ) {
          return callback(err)
        }

        if (
          (err != null ? err.message : undefined) === 'EmailAlreadyRegistered'
        ) {
          logger.log({ email }, 'user already exists, resending welcome email')
        }

        const ONE_WEEK = 7 * 24 * 60 * 60 // seconds
        OneTimeTokenHandler.getNewToken(
          'password',
          { user_id: user._id.toString(), email },
          { expiresIn: ONE_WEEK },
          (err, token) => {
            if (err != null) {
              return callback(err)
            }

            const setNewPasswordUrl = `${
              settings.siteUrl
            }/user/activate?token=${token}&user_id=${user._id}`

            EmailHandler.sendEmail(
              'registered',
              {
                to: user.email,
                setNewPasswordUrl
              },
              () => {}
            )

            callback(null, user, setNewPasswordUrl)
          }
        )
      }
    )
  }
}

module.exports = UserRegistrationHandler
