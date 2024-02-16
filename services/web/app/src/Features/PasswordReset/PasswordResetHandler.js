const settings = require('@overleaf/settings')
const UserAuditLogHandler = require('../User/UserAuditLogHandler')
const UserGetter = require('../User/UserGetter')
const OneTimeTokenHandler = require('../Security/OneTimeTokenHandler')
const EmailHandler = require('../Email/EmailHandler')
const AuthenticationManager = require('../Authentication/AuthenticationManager')
const { callbackify, promisify } = require('util')

const AUDIT_LOG_TOKEN_PREFIX_LENGTH = 10

async function generateAndEmailResetToken(email) {
  const user = await UserGetter.promises.getUserByAnyEmail(email)

  if (!user) {
    return null
  }

  if (user.email !== email) {
    return 'secondary'
  }

  const data = { user_id: user._id.toString(), email }
  const token = await OneTimeTokenHandler.promises.getNewToken('password', data)

  const emailOptions = {
    to: email,
    setNewPasswordUrl: `${
      settings.siteUrl
    }/user/password/set?passwordResetToken=${token}&email=${encodeURIComponent(
      email
    )}`,
  }

  await EmailHandler.promises.sendEmail('passwordResetRequested', emailOptions)

  return 'primary'
}

function expirePasswordResetToken(token, callback) {
  OneTimeTokenHandler.expireToken('password', token, err => {
    return callback(err)
  })
}

function getUserForPasswordResetToken(token, callback) {
  OneTimeTokenHandler.peekValueFromToken(
    'password',
    token,
    (err, data, remainingUses) => {
      if (err != null) {
        if (err.name === 'NotFoundError') {
          return callback(null, null)
        } else {
          return callback(err)
        }
      }
      if (data == null || data.email == null) {
        return callback(null, null, remainingUses)
      }
      UserGetter.getUserByMainEmail(
        data.email,
        { _id: 1, 'overleaf.id': 1, email: 1 },
        (err, user) => {
          if (err != null) {
            callback(err)
          } else if (user == null) {
            callback(null, null, 0)
          } else if (
            data.user_id != null &&
            data.user_id === user._id.toString()
          ) {
            callback(null, user, remainingUses)
          } else if (
            data.v1_user_id != null &&
            user.overleaf != null &&
            data.v1_user_id === user.overleaf.id
          ) {
            callback(null, user, remainingUses)
          } else {
            callback(null, null, 0)
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
    auditLog.ip,
    { token: token.substring(0, AUDIT_LOG_TOKEN_PREFIX_LENGTH) }
  )

  const reset = await AuthenticationManager.promises.setUserPassword(
    user,
    password
  )

  await PasswordResetHandler.promises.expirePasswordResetToken(token)

  return { found: true, reset, userId: user._id }
}

const PasswordResetHandler = {
  generateAndEmailResetToken: callbackify(generateAndEmailResetToken),

  setNewUserPassword: callbackify(setNewUserPassword),

  getUserForPasswordResetToken,

  expirePasswordResetToken,
}

PasswordResetHandler.promises = {
  generateAndEmailResetToken,
  getUserForPasswordResetToken: promisify(
    PasswordResetHandler.getUserForPasswordResetToken
  ),
  expirePasswordResetToken: promisify(
    PasswordResetHandler.expirePasswordResetToken
  ),
  setNewUserPassword,
}

module.exports = PasswordResetHandler
