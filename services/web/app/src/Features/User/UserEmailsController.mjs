import AuthenticationController from '../Authentication/AuthenticationController.mjs'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import SessionManager from '../Authentication/SessionManager.mjs'
import UserGetter from './UserGetter.mjs'
import UserUpdater from './UserUpdater.mjs'
import UserSessionsManager from './UserSessionsManager.mjs'
import EmailHandler from '../Email/EmailHandler.mjs'
import EmailHelper from '../Helpers/EmailHelper.mjs'
import UserEmailsConfirmationHandler from './UserEmailsConfirmationHandler.mjs'
import InstitutionsAPI from '../Institutions/InstitutionsAPI.mjs'
import Errors from '../Errors/Errors.js'
import HttpErrorHandler from '../Errors/HttpErrorHandler.mjs'
import { expressify } from '@overleaf/promise-utils'
import AsyncFormHelper from '../Helpers/AsyncFormHelper.mjs'
import AnalyticsManager from '../Analytics/AnalyticsManager.mjs'
import UserPrimaryEmailCheckHandler from '../User/UserPrimaryEmailCheckHandler.mjs'
import UserAuditLogHandler from './UserAuditLogHandler.mjs'
import { RateLimiter } from '../../infrastructure/RateLimiter.mjs'
import Features from '../../infrastructure/Features.mjs'
import tsscmp from 'tsscmp'
import Modules from '../../infrastructure/Modules.mjs'

const AUDIT_LOG_TOKEN_PREFIX_LENGTH = 10

const sendConfirmCodeRateLimiter = new RateLimiter('send-confirmation-code', {
  points: 1,
  duration: 60,
})
const checkConfirmCodeRateLimiter = new RateLimiter(
  'check-confirmation-code-per-email',
  {
    points: 10,
    duration: 60,
  }
)
const resendConfirmCodeRateLimiter = new RateLimiter(
  'resend-confirmation-code',
  {
    points: 1,
    duration: 60,
  }
)

async function _sendSecurityAlertEmail(user, email) {
  const emailOptions = {
    to: user.email,
    actionDescribed: `a secondary email address has been added to your account ${user.email}`,
    message: [
      `<span style="display:inline-block;padding: 0 20px;width:100%;">Added: <br/><b>${email}</b></span>`,
    ],
    action: 'secondary email address added',
  }
  await EmailHandler.promises.sendEmail('securityAlert', emailOptions)
}

async function sendExistingEmailConfirmationCode(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const email = EmailHelper.parseEmail(req.body.email)
  if (!email) {
    return res.sendStatus(400)
  }
  const user = await UserGetter.promises.getUserByAnyEmail(email, {
    _id: 1,
    email,
  })
  if (!user || user._id.toString() !== userId) {
    return res.sendStatus(422)
  }
  await sendCodeAndStoreInSession(req, 'pendingExistingEmail', email)
  res.sendStatus(204)
}

/**
 * This method is for adding a secondary email to be confirmed via a code.
 */
async function addWithConfirmationCode(req, res) {
  delete req.session.pendingSecondaryEmail

  const userId = SessionManager.getLoggedInUserId(req.session)
  const email = EmailHelper.parseEmail(req.body.email)
  const affiliationOptions = {
    university: req.body.university,
    role: req.body.role,
    department: req.body.department,
  }

  if (!email) {
    return res.sendStatus(422)
  }

  const user = await UserGetter.promises.getUser(userId, {
    email: 1,
    'emails.email': 1,
  })

  if (user.emails.length >= Settings.emailAddressLimit) {
    return res.status(422).json({ message: 'secondary email limit exceeded' })
  }

  try {
    await UserGetter.promises.ensureUniqueEmailAddress(email)

    await sendConfirmCodeRateLimiter.consume(email, 1, {
      method: 'email',
    })

    await UserAuditLogHandler.promises.addEntry(
      userId,
      'request-add-email-code',
      userId,
      req.ip,
      {
        newSecondaryEmail: email,
      }
    )

    await sendCodeAndStoreInSession(
      req,
      'pendingSecondaryEmail',
      email,
      affiliationOptions
    )

    return res.sendStatus(200)
  } catch (err) {
    if (err.name === 'EmailExistsError') {
      return res.status(409).json({
        message: {
          type: 'error',
          text: req.i18n.translate('email_already_registered'),
        },
      })
    }

    if (err?.remainingPoints === 0) {
      return res.status(429).json({})
    }

    logger.err({ err }, 'failed to send confirmation code')

    delete req.session.pendingSecondaryEmail

    return res.status(500).json({
      message: {
        key: 'error_performing_request',
      },
    })
  }
}

/**
 * @param {import('express').Request} req
 * @param {string} sessionKey
 * @param {string} email
 * @param affiliationOptions
 * @returns {Promise<void>}
 */
async function sendCodeAndStoreInSession(
  req,
  sessionKey,
  email,
  affiliationOptions
) {
  const { confirmCode, confirmCodeExpiresTimestamp } =
    await UserEmailsConfirmationHandler.promises.sendConfirmationCode(
      email,
      false
    )
  req.session[sessionKey] = {
    email,
    confirmCode,
    confirmCodeExpiresTimestamp,
    affiliationOptions,
  }
}

/**
 * @param {string} sessionKey
 * @param {(req: import('express').Request, user: any, email: string, affiliationOptions: any) => Promise<void>} beforeConfirmEmail
 * @returns {Promise<*>}
 */
const _checkConfirmationCode =
  (sessionKey, beforeConfirmEmail) => async (req, res) => {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const code = req.body.code
    const user = await UserGetter.promises.getUser(userId, {
      email: 1,
      'emails.email': 1,
    })

    const sessionData = req.session[sessionKey]

    if (!sessionData) {
      logger.err({}, `error checking confirmation code. missing ${sessionKey}`)

      return res.status(422).json({
        message: {
          key: 'error_performing_request',
        },
      })
    }

    const emailToCheck = sessionData.email

    try {
      await checkConfirmCodeRateLimiter.consume(emailToCheck, 1, {
        method: 'email',
      })
    } catch (err) {
      if (err?.remainingPoints === 0) {
        return res.sendStatus(429)
      } else {
        return res.status(500).json({
          message: {
            key: 'error_performing_request',
          },
        })
      }
    }

    if (sessionData.confirmCodeExpiresTimestamp < Date.now()) {
      return res.status(403).json({
        message: { key: 'expired_confirmation_code' },
      })
    }

    if (!tsscmp(sessionData.confirmCode, code)) {
      return res.status(403).json({
        message: { key: 'invalid_confirmation_code' },
      })
    }

    try {
      await beforeConfirmEmail(
        req,
        user,
        emailToCheck,
        sessionData.affiliationOptions
      )

      await UserUpdater.promises.confirmEmail(
        userId,
        emailToCheck,
        sessionData.affiliationOptions
      )

      delete req.session[sessionKey]

      AnalyticsManager.recordEventForUserInBackground(
        user._id,
        'email-verified',
        {
          provider: 'email',
          verification_type: 'token',
          isPrimary: user.email === emailToCheck,
        }
      )

      const redirectUrl =
        AuthenticationController.getRedirectFromSession(req) || '/project'

      return res.json({
        redir: redirectUrl,
      })
    } catch (error) {
      if (error.name === 'EmailExistsError') {
        return res.status(409).json({
          message: {
            type: 'error',
            text: req.i18n.translate('email_already_registered'),
          },
        })
      }

      if (error.name === 'InvalidInstitutionalEmailError') {
        return res.status(422).json({
          message: {
            key: 'email_does_not_belong_to_university',
          },
        })
      }

      logger.err({ error }, 'failed to check confirmation code')

      return res.status(500).json({
        message: {
          key: 'error_performing_request',
        },
      })
    }
  }

const checkNewSecondaryEmailConfirmationCode = _checkConfirmationCode(
  'pendingSecondaryEmail',
  async (req, user, email, affiliationOptions) => {
    await UserAuditLogHandler.promises.addEntry(
      user._id,
      'add-email-via-code',
      user._id,
      req.ip,
      { newSecondaryEmail: email }
    )
    await UserUpdater.promises.addEmailAddress(
      user._id,
      email,
      affiliationOptions,
      {
        initiatorId: user._id,
        ipAddress: req.ip,
      }
    )
    await _sendSecurityAlertEmail(user, email)
  }
)

const checkExistingEmailConfirmationCode = _checkConfirmationCode(
  'pendingExistingEmail',
  async (req, user, email) => {
    await UserAuditLogHandler.promises.addEntry(
      user._id,
      'confirm-email-via-code',
      user._id,
      req.ip,
      { email }
    )
  }
)

const _resendConfirmationCode =
  (sessionKey, operation, auditLogEmailKey) => async (req, res) => {
    const sessionData = req.session[sessionKey]
    if (!sessionData) {
      logger.err({}, `error resending confirmation code. missing ${sessionKey}`)
      return res.status(422).json({
        message: {
          key: 'error_performing_request',
        },
      })
    }

    const email = sessionData.email

    try {
      await resendConfirmCodeRateLimiter.consume(email, 1, { method: 'email' })
    } catch (err) {
      if (err?.remainingPoints === 0) {
        return res.status(429).json({})
      } else {
        throw err
      }
    }

    const userId = SessionManager.getLoggedInUserId(req.session)

    try {
      await UserAuditLogHandler.promises.addEntry(
        userId,
        operation,
        userId,
        req.ip,
        { [auditLogEmailKey]: email }
      )

      const { confirmCode, confirmCodeExpiresTimestamp } =
        await UserEmailsConfirmationHandler.promises.sendConfirmationCode(
          email,
          false
        )

      sessionData.confirmCode = confirmCode
      sessionData.confirmCodeExpiresTimestamp = confirmCodeExpiresTimestamp

      return res.status(200).json({ message: { key: 'we_sent_new_code' } })
    } catch (err) {
      logger.err({ err, userId, email }, 'failed to send confirmation code')
      return res.status(500).json({ key: 'error_performing_request' })
    }
  }

const resendNewSecondaryEmailConfirmationCode = _resendConfirmationCode(
  'pendingSecondaryEmail',
  'resend-add-email-code',
  'newSecondaryEmail'
)

const resendExistingSecondaryEmailConfirmationCode = _resendConfirmationCode(
  'pendingExistingEmail',
  'resend-confirm-email-code',
  'email'
)

async function confirmSecondaryEmailPage(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)

  if (!req.session.pendingSecondaryEmail) {
    const redirectURL =
      AuthenticationController.getRedirectFromSession(req) || '/project'
    return res.redirect(redirectURL)
  }

  AnalyticsManager.recordEventForUserInBackground(
    userId,
    'confirm-secondary-email-page-displayed'
  )

  res.render('user/confirmSecondaryEmail', {
    email: req.session.pendingSecondaryEmail.email,
  })
}

async function addSecondaryEmailPage(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)

  const confirmedEmails =
    await UserGetter.promises.getUserConfirmedEmails(userId)

  if (confirmedEmails.length >= 2) {
    const redirectURL =
      AuthenticationController.getRedirectFromSession(req) || '/project'
    return res.redirect(redirectURL)
  }

  AnalyticsManager.recordEventForUserInBackground(
    userId,
    'add-secondary-email-page-displayed'
  )

  res.render('user/addSecondaryEmail')
}

async function primaryEmailCheckPage(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const user = await UserGetter.promises.getUser(userId, {
    lastPrimaryEmailCheck: 1,
    signUpDate: 1,
    email: 1,
    emails: 1,
  })

  if (!UserPrimaryEmailCheckHandler.requiresPrimaryEmailCheck(user)) {
    return res.redirect('/project')
  }

  AnalyticsManager.recordEventForUserInBackground(
    userId,
    'primary-email-check-page-displayed'
  )

  res.render('user/primaryEmailCheck')
}

async function primaryEmailCheck(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  await UserUpdater.promises.updateUser(userId, {
    $set: { lastPrimaryEmailCheck: new Date() },
  })

  AnalyticsManager.recordEventForUserInBackground(
    userId,
    'primary-email-check-done'
  )

  // We want to redirect to prompt a user to add a secondary email if their primary
  // is an institutional email and they dont' already have a secondary.
  if (Features.hasFeature('saas') && req.capabilitySet.has('add-affiliation')) {
    const confirmedEmails =
      await UserGetter.promises.getUserConfirmedEmails(userId)

    if (confirmedEmails.length < 2) {
      const { email: primaryEmail } = SessionManager.getSessionUser(req.session)
      const primaryEmailDomain = EmailHelper.getDomain(primaryEmail)

      const institution = (
        await Modules.promises.hooks.fire(
          'getInstitutionViaDomain',
          primaryEmailDomain
        )
      )?.[0]

      if (institution) {
        return AsyncFormHelper.redirect(req, res, '/user/emails/add-secondary')
      }
    }
  }

  AsyncFormHelper.redirect(req, res, '/project')
}

async function showConfirm(req, res, next) {
  res.render('user/confirm_email', {
    token: req.query.token,
    title: 'confirm_email',
  })
}

async function remove(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const email = EmailHelper.parseEmail(req.body.email)
  if (!email) {
    return res.sendStatus(422)
  }
  const auditLog = {
    initiatorId: userId,
    ipAddress: req.ip,
  }
  await UserUpdater.promises.removeEmailAddress(userId, email, auditLog)
  res.sendStatus(200)
}

async function setDefault(req, res, next) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const email = EmailHelper.parseEmail(req.body.email)

  if (!email) {
    return res.sendStatus(422)
  }

  const { emails, email: oldDefault } = await UserGetter.promises.getUser(
    userId,
    { email: 1, emails: 1 }
  )
  const primaryEmailData = emails?.find(email => email.email === oldDefault)
  const deleteOldEmail =
    req.query['delete-unconfirmed-primary'] !== undefined &&
    primaryEmailData &&
    !primaryEmailData.confirmedAt

  const auditLog = {
    initiatorId: userId,
    ipAddress: req.ip,
  }
  try {
    await UserUpdater.promises.setDefaultEmailAddress(
      userId,
      email,
      false,
      auditLog,
      true,
      deleteOldEmail
    )
  } catch (err) {
    return UserEmailsController._handleEmailError(err, req, res, next)
  }
  SessionManager.setInSessionUser(req.session, { email })
  const user = SessionManager.getSessionUser(req.session)
  try {
    await UserSessionsManager.promises.removeSessionsFromRedis(
      user,
      req.sessionID // remove all sessions except the current session
    )
  } catch (err) {
    logger.warn(
      { err },
      'failed revoking secondary sessions after changing default email'
    )
  }
  if (
    req.query['delete-unconfirmed-primary'] !== undefined &&
    primaryEmailData &&
    !primaryEmailData.confirmedAt
  ) {
    await UserUpdater.promises.removeEmailAddress(
      userId,
      primaryEmailData.email,
      {
        initiatorId: userId,
        ipAddress: req.ip,
        extraInfo: {
          info: 'removed unconfirmed email after setting new primary',
        },
      }
    )
  }
  res.sendStatus(200)
}

const UserEmailsController = {
  list(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    UserGetter.getUserFullEmails(userId, function (error, fullEmails) {
      if (error) {
        return next(error)
      }
      res.json(fullEmails)
    })
  },

  addWithConfirmationCode: expressify(addWithConfirmationCode),

  checkNewSecondaryEmailConfirmationCode: expressify(
    checkNewSecondaryEmailConfirmationCode
  ),

  checkExistingEmailConfirmationCode: expressify(
    checkExistingEmailConfirmationCode
  ),

  resendNewSecondaryEmailConfirmationCode: expressify(
    resendNewSecondaryEmailConfirmationCode
  ),

  resendExistingSecondaryEmailConfirmationCode: expressify(
    resendExistingSecondaryEmailConfirmationCode
  ),

  remove: expressify(remove),

  setDefault: expressify(setDefault),

  endorse(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const email = EmailHelper.parseEmail(req.body.email)
    if (!email) {
      return res.sendStatus(422)
    }

    InstitutionsAPI.endorseAffiliation(
      userId,
      email,
      req.body.role,
      req.body.department,
      function (error) {
        if (error) {
          return next(error)
        }
        res.sendStatus(204)
      }
    )
  },

  sendExistingEmailConfirmationCode: expressify(
    sendExistingEmailConfirmationCode
  ),

  addSecondaryEmailPage: expressify(addSecondaryEmailPage),

  confirmSecondaryEmailPage: expressify(confirmSecondaryEmailPage),

  primaryEmailCheckPage: expressify(primaryEmailCheckPage),

  primaryEmailCheck: expressify(primaryEmailCheck),

  showConfirm: expressify(showConfirm),

  confirm(req, res, next) {
    const { token } = req.body
    if (!token) {
      return res.status(422).json({
        message: req.i18n.translate('confirmation_link_broken'),
      })
    }
    UserEmailsConfirmationHandler.confirmEmailFromToken(
      req,
      token,
      function (error, userData) {
        if (error) {
          if (error instanceof Errors.ForbiddenError) {
            res.status(403).json({
              message: {
                key: 'confirm-email-wrong-user',
                text: `We can’t confirm this email. You must be logged in with the Overleaf account that requested the new secondary email.`,
              },
            })
          } else if (error instanceof Errors.NotFoundError) {
            res.status(404).json({
              message: req.i18n.translate('confirmation_token_invalid'),
            })
          } else {
            next(error)
          }
        } else {
          const { userId, email } = userData
          const tokenPrefix = token.substring(0, AUDIT_LOG_TOKEN_PREFIX_LENGTH)
          UserAuditLogHandler.addEntry(
            userId,
            'confirm-email',
            userId,
            req.ip,
            { token: tokenPrefix, email },
            auditLogError => {
              if (auditLogError) {
                logger.error(
                  { error: auditLogError, userId, token: tokenPrefix },
                  'failed to add audit log entry'
                )
              }
              UserGetter.getUser(
                userData.userId,
                { email: 1 },
                function (error, user) {
                  if (error) {
                    logger.error(
                      { error, userId: userData.userId },
                      'failed to get user'
                    )
                  }
                  const isPrimary = user?.email === userData.email
                  AnalyticsManager.recordEventForUserInBackground(
                    userData.userId,
                    'email-verified',
                    {
                      provider: 'email',
                      verification_type: 'link',
                      isPrimary,
                    }
                  )
                  res.sendStatus(200)
                }
              )
            }
          )
        }
      }
    )
  },

  _handleEmailError(error, req, res, next) {
    if (error instanceof Errors.UnconfirmedEmailError) {
      return HttpErrorHandler.conflict(req, res, 'email must be confirmed')
    } else if (error instanceof Errors.EmailExistsError) {
      const message = req.i18n.translate('email_already_registered')
      return HttpErrorHandler.conflict(req, res, message)
    } else if (error.message === '422: Email does not belong to university') {
      const message = req.i18n.translate('email_does_not_belong_to_university')
      return HttpErrorHandler.conflict(req, res, message)
    }
    next(error)
  },
}

export default UserEmailsController
