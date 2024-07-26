const EmailHelper = require('../Helpers/EmailHelper')
const EmailHandler = require('../Email/EmailHandler')
const OneTimeTokenHandler = require('../Security/OneTimeTokenHandler')
const settings = require('@overleaf/settings')
const Errors = require('../Errors/Errors')
const UserUpdater = require('./UserUpdater')
const UserGetter = require('./UserGetter')
const { callbackify, promisify } = require('util')
const crypto = require('crypto')
const SessionManager = require('../Authentication/SessionManager')

// Reject email confirmation tokens after 90 days
const TOKEN_EXPIRY_IN_S = 90 * 24 * 60 * 60
const TOKEN_USE = 'email_confirmation'
const CONFIRMATION_CODE_EXPIRY_IN_S = 10 * 60

function sendConfirmationEmail(userId, email, emailTemplate, callback) {
  if (arguments.length === 3) {
    callback = emailTemplate
    emailTemplate = 'confirmEmail'
  }

  email = EmailHelper.parseEmail(email)
  if (!email) {
    return callback(new Error('invalid email'))
  }
  const data = { user_id: userId, email }
  OneTimeTokenHandler.getNewToken(
    TOKEN_USE,
    data,
    { expiresIn: TOKEN_EXPIRY_IN_S },
    function (err, token) {
      if (err) {
        return callback(err)
      }
      const emailOptions = {
        to: email,
        confirmEmailUrl: `${settings.siteUrl}/user/emails/confirm?token=${token}`,
        sendingUser_id: userId,
      }
      EmailHandler.sendEmail(emailTemplate, emailOptions, callback)
    }
  )
}

async function sendConfirmationCode(email, isSecondary) {
  if (!EmailHelper.parseEmail(email)) {
    throw new Error('invalid email')
  }

  const confirmCode = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
  const confirmCodeExpiresTimestamp =
    Date.now() + CONFIRMATION_CODE_EXPIRY_IN_S * 1000

  await EmailHandler.promises.sendEmail('confirmCode', {
    to: email,
    confirmCode,
    isSecondary,
    category: ['ConfirmEmail'],
  })

  return {
    confirmCode,
    confirmCodeExpiresTimestamp,
  }
}

async function sendReconfirmationEmail(userId, email) {
  email = EmailHelper.parseEmail(email)
  if (!email) {
    throw new Error('invalid email')
  }

  const data = { user_id: userId, email }
  const token = await OneTimeTokenHandler.promises.getNewToken(
    TOKEN_USE,
    data,
    { expiresIn: TOKEN_EXPIRY_IN_S }
  )

  const emailOptions = {
    to: email,
    confirmEmailUrl: `${settings.siteUrl}/user/emails/confirm?token=${token}`,
    sendingUser_id: userId,
  }

  await EmailHandler.promises.sendEmail('reconfirmEmail', emailOptions)
}

async function confirmEmailFromToken(req, token) {
  const { data } = await OneTimeTokenHandler.promises.peekValueFromToken(
    TOKEN_USE,
    token
  )
  if (!data) {
    throw new Errors.NotFoundError('no token found')
  }

  const loggedInUserId = SessionManager.getLoggedInUserId(req.session)
  // user_id may be stored as an ObjectId or string
  const userId = data.user_id?.toString()
  const email = data.email
  if (!userId || email !== EmailHelper.parseEmail(email)) {
    throw new Errors.NotFoundError('invalid data')
  }
  if (loggedInUserId !== userId) {
    throw new Errors.ForbiddenError('logged in user does not match token user')
  }
  const user = await UserGetter.promises.getUser(userId, { emails: 1 })
  if (!user) {
    throw new Errors.NotFoundError('user not found')
  }
  const emailExists = user.emails.some(emailData => emailData.email === email)
  if (!emailExists) {
    throw new Errors.NotFoundError('email missing for user')
  }

  await OneTimeTokenHandler.promises.expireToken(TOKEN_USE, token)
  await UserUpdater.promises.confirmEmail(userId, email)

  return { userId, email }
}

const UserEmailsConfirmationHandler = {
  sendConfirmationEmail,

  sendReconfirmationEmail: callbackify(sendReconfirmationEmail),

  confirmEmailFromToken: callbackify(confirmEmailFromToken),
}

UserEmailsConfirmationHandler.promises = {
  sendConfirmationEmail: promisify(sendConfirmationEmail),
  confirmEmailFromToken,
  sendConfirmationCode,
  sendReconfirmationEmail,
}

module.exports = UserEmailsConfirmationHandler
