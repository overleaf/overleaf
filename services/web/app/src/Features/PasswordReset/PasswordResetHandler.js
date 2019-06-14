const settings = require('settings-sharelatex')
const UserGetter = require('../User/UserGetter')
const OneTimeTokenHandler = require('../Security/OneTimeTokenHandler')
const EmailHandler = require('../Email/EmailHandler')
const AuthenticationManager = require('../Authentication/AuthenticationManager')

const PasswordResetHandler = {
  generateAndEmailResetToken(email, callback) {
    UserGetter.getUserByAnyEmail(email, (err, user) => {
      if (err || !user) {
        return callback(err, null)
      }
      if (user.email !== email) {
        return callback(null, 'secondary')
      }
      const data = { user_id: user._id.toString(), email: email }
      OneTimeTokenHandler.getNewToken('password', data, (err, token) => {
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
        EmailHandler.sendEmail('passwordResetRequested', emailOptions, err => {
          if (err) {
            return callback(err)
          }
          callback(null, 'primary')
        })
      })
    })
  },

  setNewUserPassword(token, password, callback) {
    PasswordResetHandler.getUserForPasswordResetToken(token, (err, user) => {
      if (err) {
        return callback(err)
      }
      if (!user) {
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
    })
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
              callback(null, user)
            } else if (
              data.v1_user_id != null &&
              user.overleaf != null &&
              data.v1_user_id === user.overleaf.id
            ) {
              callback(null, user)
            } else {
              callback(null, null)
            }
          }
        )
      }
    )
  }
}

module.exports = PasswordResetHandler
