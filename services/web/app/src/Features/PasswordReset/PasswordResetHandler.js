const settings = require('settings-sharelatex')
const UserGetter = require('../User/UserGetter')
const OneTimeTokenHandler = require('../Security/OneTimeTokenHandler')
const EmailHandler = require('../Email/EmailHandler')
const AuthenticationManager = require('../Authentication/AuthenticationManager')
const logger = require('logger-sharelatex')
const V1Api = require('../V1/V1Api')

const PasswordResetHandler = {
  generateAndEmailResetToken(email, callback) {
    PasswordResetHandler._getPasswordResetData(email, function(
      error,
      exists,
      data
    ) {
      if (error != null) {
        callback(error)
      } else if (exists) {
        OneTimeTokenHandler.getNewToken('password', data, function(err, token) {
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
          EmailHandler.sendEmail(
            'passwordResetRequested',
            emailOptions,
            function(error) {
              if (error != null) {
                return callback(error)
              }
              callback(null, 'primary')
            }
          )
        })
      } else {
        UserGetter.getUserByAnyEmail(email, function(err, user) {
          if (err != null) {
            return callback(err)
          }
          if (!user) {
            callback(null, null)
          } else if (user.overleaf == null || user.overleaf.id == null) {
            callback(null, 'sharelatex')
          } else {
            callback(null, 'secondary')
          }
        })
      }
    })
  },

  setNewUserPassword(token, password, callback) {
    OneTimeTokenHandler.getValueFromTokenAndExpire('password', token, function(
      err,
      data
    ) {
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
        AuthenticationManager.setUserPassword(data.user_id, password, function(
          err,
          reset
        ) {
          if (err) {
            return callback(err)
          }
          callback(null, reset, data.user_id)
        })
      } else if (data.v1_user_id != null) {
        AuthenticationManager.setUserPasswordInV1(
          data.v1_user_id,
          password,
          function(error, reset) {
            if (error != null) {
              return callback(error)
            }
            UserGetter.getUser(
              { 'overleaf.id': data.v1_user_id },
              { _id: 1 },
              function(error, user) {
                if (error != null) {
                  return callback(error)
                }
                callback(null, reset, user != null ? user._id : undefined)
              }
            )
          }
        )
      }
    })
  },

  _getPasswordResetData(email, callback) {
    if (settings.overleaf != null) {
      // Overleaf v2
      V1Api.request(
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
            callback(null, false)
          } else {
            callback(null, true, { v1_user_id: body.user_id, email: email })
          }
        }
      )
    } else {
      // ShareLaTeX
      UserGetter.getUserByMainEmail(email, function(err, user) {
        if (err) {
          return callback(err)
        }
        if (user == null || user.holdingAccount || user.overleaf != null) {
          logger.err({ email }, 'user could not be found for password reset')
          return callback(null, false)
        }
        callback(null, true, { user_id: user._id, email: email })
      })
    }
  }
}

module.exports = PasswordResetHandler
