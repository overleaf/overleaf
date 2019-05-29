/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let UserEmailsConfirmationHandler
const EmailHelper = require('../Helpers/EmailHelper')
const EmailHandler = require('../Email/EmailHandler')
const OneTimeTokenHandler = require('../Security/OneTimeTokenHandler')
const settings = require('settings-sharelatex')
const Errors = require('../Errors/Errors')
const logger = require('logger-sharelatex')
const UserUpdater = require('./UserUpdater')
const UserGetter = require('./UserGetter')

const ONE_YEAR_IN_S = 365 * 24 * 60 * 60

module.exports = UserEmailsConfirmationHandler = {
  sendConfirmationEmail(user_id, email, emailTemplate, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    if (arguments.length === 3) {
      callback = emailTemplate
      emailTemplate = 'confirmEmail'
    }

    // when force-migrating accounts to v2 from v1, we don't want to send confirmation messages -
    // setting this env var allows us to turn this behaviour off
    if (process.env['SHARELATEX_NO_CONFIRMATION_MESSAGES'] != null) {
      return callback(null)
    }

    email = EmailHelper.parseEmail(email)
    if (email == null) {
      return callback(new Error('invalid email'))
    }
    const data = { user_id, email }
    return OneTimeTokenHandler.getNewToken(
      'email_confirmation',
      data,
      { expiresIn: ONE_YEAR_IN_S },
      function(err, token) {
        if (err != null) {
          return callback(err)
        }
        const emailOptions = {
          to: email,
          confirmEmailUrl: `${
            settings.siteUrl
          }/user/emails/confirm?token=${token}`,
          sendingUser_id: user_id
        }
        return EmailHandler.sendEmail(emailTemplate, emailOptions, callback)
      }
    )
  },

  confirmEmailFromToken(token, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    logger.log(
      { token_start: token.slice(0, 8) },
      'confirming email from token'
    )
    return OneTimeTokenHandler.getValueFromTokenAndExpire(
      'email_confirmation',
      token,
      function(error, data) {
        if (error != null) {
          return callback(error)
        }
        if (data == null) {
          return callback(new Errors.NotFoundError('no token found'))
        }
        const { user_id, email } = data
        logger.log(
          { data, user_id, email, token_start: token.slice(0, 8) },
          'found data for email confirmation'
        )
        if (user_id == null || email !== EmailHelper.parseEmail(email)) {
          return callback(new Errors.NotFoundError('invalid data'))
        }
        return UserGetter.getUser(user_id, {}, function(error, user) {
          if (error != null) {
            return callback(error)
          }
          if (!(user != null ? user._id : undefined)) {
            return callback(new Errors.NotFoundError('user not found'))
          }
          return UserUpdater.confirmEmail(user_id, email, callback)
        })
      }
    )
  }
}
