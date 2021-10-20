const settings = require('@overleaf/settings')
const UserAuditLogHandler = require('../User/UserAuditLogHandler')
const UserGetter = require('../User/UserGetter')
const OneTimeTokenHandler = require('../Security/OneTimeTokenHandler')
const EmailHandler = require('../Email/EmailHandler')
const AuthenticationManager = require('../Authentication/AuthenticationManager')
const { callbackify, promisify } = require('util')

function generateAndEmailResetToken(email, callback) {
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
        )}`,
      }
      EmailHandler.sendEmail('passwordResetRequested', emailOptions, err => {
        if (err) {
          return callback(err)
        }
        callback(null, 'primary')
      })
    })
  })
}

function getUserForPasswordResetToken(token, callback) {
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
        { _id: 1, 'overleaf.id': 1, email: 1 },
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

async function setNewUserPassword(token, password, auditLog) {
  const user = await PasswordResetHandler.promises.getUserForPasswordResetToken(
    token
  )

  if (!user) {
    return {
      found: false,
      reset: false,
      userId: null,
    }
  }

  await UserAuditLogHandler.promises.addEntry(
    user._id,
    'reset-password',
    auditLog.initiatorId,
    auditLog.ip
  )

  const reset = await AuthenticationManager.promises.setUserPassword(
    user,
    password
  )

  return { found: true, reset, userId: user._id }
}

const PasswordResetHandler = {
  generateAndEmailResetToken,

  setNewUserPassword: callbackify(setNewUserPassword),

  getUserForPasswordResetToken,
}

PasswordResetHandler.promises = {
  getUserForPasswordResetToken: promisify(
    PasswordResetHandler.getUserForPasswordResetToken
  ),
  setNewUserPassword,
}

module.exports = PasswordResetHandler
