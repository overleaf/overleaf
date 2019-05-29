/* eslint-disable
    handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let UserRegistrationHandler
const { User } = require('../../models/User')
const UserCreator = require('./UserCreator')
const UserGetter = require('./UserGetter')
const AuthenticationManager = require('../Authentication/AuthenticationManager')
const NewsLetterManager = require('../Newsletter/NewsletterManager')
const async = require('async')
const logger = require('logger-sharelatex')
const crypto = require('crypto')
const EmailHandler = require('../Email/EmailHandler')
const OneTimeTokenHandler = require('../Security/OneTimeTokenHandler')
const Analytics = require('../Analytics/AnalyticsManager')
const settings = require('settings-sharelatex')
const EmailHelper = require('../Helpers/EmailHelper')

module.exports = UserRegistrationHandler = {
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
      return UserCreator.createNewUser(
        {
          holdingAccount: false,
          email: userDetails.email,
          first_name: userDetails.first_name,
          last_name: userDetails.last_name
        },
        callback
      )
    } else {
      return callback(null, user)
    }
  },

  registerNewUser(userDetails, callback) {
    const self = this
    const requestIsValid = this._registrationRequestIsValid(userDetails)
    if (!requestIsValid) {
      return callback(new Error('request is not valid'))
    }
    userDetails.email = EmailHelper.parseEmail(userDetails.email)
    return UserGetter.getUserByAnyEmail(userDetails.email, (err, user) => {
      if (err != null) {
        return callback(err)
      }
      if ((user != null ? user.holdingAccount : undefined) === false) {
        return callback(new Error('EmailAlreadyRegistered'), user)
      }
      return self._createNewUserIfRequired(user, userDetails, function(
        err,
        user
      ) {
        if (err != null) {
          return callback(err)
        }
        return async.series(
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
            function(cb) {
              if (userDetails.subscribeToNewsletter === 'true') {
                NewsLetterManager.subscribe(user, function() {})
              }
              return cb()
            } // this can be slow, just fire it off
          ],
          function(err) {
            logger.log({ user }, 'registered')
            Analytics.recordEvent(user._id, 'user-registered')
            return callback(err, user)
          }
        )
      })
    })
  },

  registerNewUserAndSendActivationEmail(email, callback) {
    if (callback == null) {
      callback = function(error, user, setNewPasswordUrl) {}
    }
    logger.log({ email }, 'registering new user')
    return UserRegistrationHandler.registerNewUser(
      {
        email,
        password: crypto.randomBytes(32).toString('hex')
      },
      function(err, user) {
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
        return OneTimeTokenHandler.getNewToken(
          'password',
          user._id,
          { expiresIn: ONE_WEEK },
          function(err, token) {
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
              function() {}
            )

            return callback(null, user, setNewPasswordUrl)
          }
        )
      }
    )
  }
}
