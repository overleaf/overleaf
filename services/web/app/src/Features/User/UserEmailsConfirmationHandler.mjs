import EmailHelper from '../Helpers/EmailHelper.mjs'
import EmailHandler from '../Email/EmailHandler.mjs'
import OneTimeTokenHandler from '../Security/OneTimeTokenHandler.mjs'
import settings from '@overleaf/settings'
import Errors from '../Errors/Errors.js'
import UserUpdater from './UserUpdater.mjs'
import UserGetter from './UserGetter.mjs'
import { callbackify } from 'node:util'
import crypto from 'node:crypto'
import SessionManager from '../Authentication/SessionManager.mjs'

// Reject email confirmation tokens after 90 days
const TOKEN_EXPIRY_IN_S = 90 * 24 * 60 * 60
const TOKEN_USE = 'email_confirmation'
const CONFIRMATION_CODE_EXPIRY_IN_S = 10 * 60

async function sendConfirmationEmail(
  userId,
  email,
  emailTemplate = 'confirmEmail'
) {
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
  await EmailHandler.promises.sendEmail(emailTemplate, emailOptions)
}

async function sendConfirmationCode(email, welcomeUser) {
  if (!EmailHelper.parseEmail(email)) {
    throw new Error('invalid email')
  }

  const confirmCode = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
  const confirmCodeExpiresTimestamp =
    Date.now() + CONFIRMATION_CODE_EXPIRY_IN_S * 1000

  await EmailHandler.promises.sendEmail('confirmCode', {
    to: email,
    confirmCode,
    welcomeUser,
    category: ['ConfirmEmail'],
  })

  return {
    confirmCode,
    confirmCodeExpiresTimestamp,
  }
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
  confirmEmailFromToken: callbackify(confirmEmailFromToken),
  sendConfirmationEmail: callbackify(sendConfirmationEmail),
}

UserEmailsConfirmationHandler.promises = {
  sendConfirmationEmail,
  confirmEmailFromToken,
  sendConfirmationCode,
}

export default UserEmailsConfirmationHandler
