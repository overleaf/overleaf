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
let PasswordResetHandler
const settings = require('settings-sharelatex')
const async = require('async')
const UserGetter = require('../User/UserGetter')
const OneTimeTokenHandler = require('../Security/OneTimeTokenHandler')
const EmailHandler = require('../Email/EmailHandler')
const AuthenticationManager = require('../Authentication/AuthenticationManager')
const logger = require('logger-sharelatex')
const V1Api = require('../V1/V1Api')

module.exports = PasswordResetHandler = {
  generateAndEmailResetToken(email, callback) {
    if (callback == null) {
      callback = function(error, status) {}
    }
    return PasswordResetHandler._getPasswordResetData(email, function(
      error,
      exists,
      data
    ) {
      if (error != null) {
        return callback(error, null)
      } else if (exists) {
        return OneTimeTokenHandler.getNewToken('password', data, function(
          err,
          token
        ) {
          if (err) {
            return callback(err)
          }
          const emailOptions = {
            to: email,
            setNewPasswordUrl: `${
              settings.siteUrl
            }/user/password/set?passwordResetToken=${token}&email=${encodeURIComponent(
              email
            )}`
          }
          return EmailHandler.sendEmail(
            'passwordResetRequested',
            emailOptions,
            function(error) {
              if (error != null) {
                return callback(error)
              }
              return callback(null, 'primary')
            }
          )
        })
      } else {
        return UserGetter.getUserByAnyEmail(email, function(err, user) {
          if (!user) {
            return callback(error, null)
          } else if (
            (user.overleaf != null ? user.overleaf.id : undefined) == null
          ) {
            return callback(error, 'sharelatex')
          } else {
            return callback(error, 'secondary')
          }
        })
      }
    })
  },

  setNewUserPassword(token, password, callback) {
    if (callback == null) {
      callback = function(error, found, user_id) {}
    }
    return OneTimeTokenHandler.getValueFromTokenAndExpire(
      'password',
      token,
      function(err, data) {
        if (err) {
          return callback(err)
        }
        if (data == null) {
          return callback(null, false, null)
        }
        if (typeof data === 'string') {
          // Backwards compatible with old format.
          // Tokens expire after 1h, so this can be removed soon after deploy.
          // Possibly we should keep this until we do an onsite release too.
          data = { user_id: data }
        }
        if (data.user_id != null) {
          return AuthenticationManager.setUserPassword(
            data.user_id,
            password,
            function(err, reset) {
              if (err) {
                return callback(err)
              }
              return callback(null, reset, data.user_id)
            }
          )
        } else if (data.v1_user_id != null) {
          return AuthenticationManager.setUserPasswordInV1(
            data.v1_user_id,
            password,
            function(error, reset) {
              if (error != null) {
                return callback(error)
              }
              return UserGetter.getUser(
                { 'overleaf.id': data.v1_user_id },
                { _id: 1 },
                function(error, user) {
                  if (error != null) {
                    return callback(error)
                  }
                  return callback(
                    null,
                    reset,
                    user != null ? user._id : undefined
                  )
                }
              )
            }
          )
        }
      }
    )
  },

  _getPasswordResetData(email, callback) {
    if (callback == null) {
      callback = function(error, exists, data) {}
    }
    if (settings.overleaf != null) {
      // Overleaf v2
      return V1Api.request(
        {
          url: '/api/v1/sharelatex/user_emails',
          qs: {
            email
          },
          expectedStatusCodes: [404]
        },
        function(error, response, body) {
          if (error != null) {
            return callback(error)
          }
          if (response.statusCode === 404) {
            return callback(null, false)
          } else {
            return callback(null, true, { v1_user_id: body.user_id })
          }
        }
      )
    } else {
      // ShareLaTeX
      return UserGetter.getUserByMainEmail(email, function(err, user) {
        if (err) {
          return callback(err)
        }
        if (user == null || user.holdingAccount || user.overleaf != null) {
          logger.err({ email }, 'user could not be found for password reset')
          return callback(null, false)
        }
        return callback(null, true, { user_id: user._id })
      })
    }
  }
}
