import settings from '@overleaf/settings'
import UserAuditLogHandler from '../User/UserAuditLogHandler.mjs'
import UserGetter from '../User/UserGetter.mjs'
import OneTimeTokenHandler from '../Security/OneTimeTokenHandler.mjs'
import EmailHandler from '../Email/EmailHandler.mjs'
import AuthenticationManager from '../Authentication/AuthenticationManager.mjs'
import { callbackify, promisify } from 'node:util'
import PermissionsManager from '../Authorization/PermissionsManager.mjs'

const assertUserPermissions = PermissionsManager.promises.assertUserPermissions

const AUDIT_LOG_TOKEN_PREFIX_LENGTH = 10

async function generateAndEmailResetToken(email) {
  const user = await UserGetter.promises.getUserByAnyEmail(email)

  if (!user) {
    return null
  }

  if (user.email !== email) {
    return 'secondary'
  }

  await assertUserPermissions(user, ['change-password'])

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

async function getUserForPasswordResetToken(token) {
  let result
  try {
    result = await OneTimeTokenHandler.promises.peekValueFromToken(
      'password',
      token
    )
  } catch (err) {
    if (err.name === 'NotFoundError') {
      return
    } else {
      throw err
    }
  }
  const { data, remainingPeeks } = result || {}

  if (data == null || data.email == null) {
    return { user: null, remainingPeeks }
  }

  const user = await UserGetter.promises.getUserByMainEmail(data.email, {
    _id: 1,
    'overleaf.id': 1,
    email: 1,
    must_reconfirm: 1,
  })

  await assertUserPermissions(user, ['change-password'])

  if (user == null) {
    return { user: null, remainingPeeks: 0 }
  } else if (data.user_id != null && data.user_id === user._id.toString()) {
    return { user, remainingPeeks }
  } else if (
    data.v1_user_id != null &&
    user.overleaf != null &&
    data.v1_user_id === user.overleaf.id
  ) {
    return { user, remainingPeeks }
  } else {
    return { user: null, remainingPeeks: 0 }
  }
}

async function setNewUserPassword(token, password, auditLog) {
  const result =
    await PasswordResetHandler.promises.getUserForPasswordResetToken(token)
  const { user } = result || {}

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

  return {
    found: true,
    reset,
    userId: user._id,
    mustReconfirm: user.must_reconfirm,
  }
}

const PasswordResetHandler = {
  generateAndEmailResetToken: callbackify(generateAndEmailResetToken),

  setNewUserPassword: callbackify(setNewUserPassword),

  getUserForPasswordResetToken: callbackify(getUserForPasswordResetToken),

  expirePasswordResetToken,
}

PasswordResetHandler.promises = {
  generateAndEmailResetToken,
  getUserForPasswordResetToken,
  expirePasswordResetToken: promisify(
    PasswordResetHandler.expirePasswordResetToken
  ),
  setNewUserPassword,
}

export default PasswordResetHandler
