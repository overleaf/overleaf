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
    PasswordResetHandler.getUserForPasswordResetToken(
      token,
      (err, user, version) => {
        if (err != null) {
          return callback(err)
        }
        if (user == null) {
          return callback(null, false, null)
        }
        AuthenticationManager.setUserPassword(
          user._id,
          password,
          (err, reset) => {
            if (err) {
              return callback(err)
            }
            callback(null, reset, user._id)
          }
        )
      }
    )
  },

  getUserForPasswordResetToken(token, callback) {
    OneTimeTokenHandler.getValueFromTokenAndExpire(
      'password',
      token,
      (err, data) => {
        if (err != null) {
          if (err.name === 'NotFoundError') {
            return callback(null, null)
          } else {
            return callback(err)
          }
        }
        if (data == null || data.email == null) {
          return callback(null, null)
        }
        UserGetter.getUserByMainEmail(
          data.email,
          { _id: 1, 'overleaf.id': 1 },
          (err, user) => {
            if (err != null) {
              callback(err)
            } else if (user == null) {
              callback(null, null)
            } else if (
              data.user_id != null &&
              data.user_id === user._id.toString()
            ) {
              callback(null, user, 'v2')
            } else if (
              data.v1_user_id != null &&
              user.overleaf != null &&
              data.v1_user_id === user.overleaf.id
            ) {
              callback(null, user, 'v1')
            } else {
              callback(null, null)
            }
          }
        )
      }
    )
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
