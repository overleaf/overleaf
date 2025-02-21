const AuthenticationController = require('../Authentication/AuthenticationController')
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const SessionManager = require('../Authentication/SessionManager')
const UserGetter = require('./UserGetter')
const UserUpdater = require('./UserUpdater')
const UserSessionsManager = require('./UserSessionsManager')
const EmailHandler = require('../Email/EmailHandler')
const EmailHelper = require('../Helpers/EmailHelper')
const UserEmailsConfirmationHandler = require('./UserEmailsConfirmationHandler')
const { endorseAffiliation } = require('../Institutions/InstitutionsAPI')
const Errors = require('../Errors/Errors')
const HttpErrorHandler = require('../Errors/HttpErrorHandler')
const { expressify } = require('@overleaf/promise-utils')
const AsyncFormHelper = require('../Helpers/AsyncFormHelper')
const AnalyticsManager = require('../Analytics/AnalyticsManager')
const UserPrimaryEmailCheckHandler = require('../User/UserPrimaryEmailCheckHandler')
const UserAuditLogHandler = require('./UserAuditLogHandler')
const { RateLimiter } = require('../../infrastructure/RateLimiter')
const Features = require('../../infrastructure/Features')
const tsscmp = require('tsscmp')
const Modules = require('../../infrastructure/Modules')
const SplitTestHandler = require('../SplitTests/SplitTestHandler')

const AUDIT_LOG_TOKEN_PREFIX_LENGTH = 10

const sendSecondaryConfirmCodeRateLimiter = new RateLimiter(
  'send-secondary-confirmation-code',
  {
    points: 1,
    duration: 60,
  }
)
const checkSecondaryConfirmCodeRateLimiter = new RateLimiter(
  'check-secondary-confirmation-code-per-email',
  {
    points: 10,
    duration: 60,
  }
)

const resendSecondaryConfirmCodeRateLimiter = new RateLimiter(
  'resend-secondary-confirmation-code',
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

/**
 * This method is for adding a secondary email to be confirmed via an emailed link.
 * For code confirmation, see the `addWithConfirmationCode` method in this file.
 */
async function add(req, res, next) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const email = EmailHelper.parseEmail(req.body.email)
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

  const affiliationOptions = {
    university: req.body.university,
    role: req.body.role,
    department: req.body.department,
  }

  try {
    await UserUpdater.promises.addEmailAddress(
      userId,
      email,
      affiliationOptions,
      {
        initiatorId: user._id,
        ipAddress: req.ip,
      }
    )
  } catch (error) {
    return UserEmailsController._handleEmailError(error, req, res, next)
  }

  await _sendSecurityAlertEmail(user, email)

  await UserEmailsConfirmationHandler.promises.sendConfirmationEmail(
    userId,
    email
  )

  res.sendStatus(204)
}

async function resendConfirmation(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const email = EmailHelper.parseEmail(req.body.email)
  if (!email) {
    return res.sendStatus(422)
  }
  const user = await UserGetter.promises.getUserByAnyEmail(email, { _id: 1 })

  if (!user || user._id.toString() !== userId) {
    return res.sendStatus(422)
  }

  await UserEmailsConfirmationHandler.promises.sendConfirmationEmail(
    userId,
    email
  )
  res.sendStatus(200)
}

async function sendReconfirmation(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const email = EmailHelper.parseEmail(req.body.email)
  if (!email) {
    return res.sendStatus(400)
  }
  const user = await UserGetter.promises.getUserByAnyEmail(email, { _id: 1 })

  if (!user || user._id.toString() !== userId) {
    return res.sendStatus(422)
  }
  await UserEmailsConfirmationHandler.promises.sendReconfirmationEmail(
    userId,
    email
  )

  res.sendStatus(204)
}

/**
 * This method is for adding a secondary email to be confirmed via a code.
 * For email link confirmation see the `add` method in this file.
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

    await sendSecondaryConfirmCodeRateLimiter.consume(email, 1, {
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

    const { confirmCode, confirmCodeExpiresTimestamp } =
      await UserEmailsConfirmationHandler.promises.sendConfirmationCode(
        email,
        true
      )

    req.session.pendingSecondaryEmail = {
      email,
      confirmCode,
      confirmCodeExpiresTimestamp,
      affiliationOptions,
    }

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

async function checkSecondaryEmailConfirmationCode(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const code = req.body.code
  const user = await UserGetter.promises.getUser(userId, {
    email: 1,
    'emails.email': 1,
  })

  if (!req.session.pendingSecondaryEmail) {
    logger.err(
      {},
      'error checking confirmation code. missing pendingSecondaryEmail'
    )

    return res.status(500).json({
      message: {
        key: 'error_performing_request',
      },
    })
  }

  const newSecondaryEmail = req.session.pendingSecondaryEmail.email

  try {
    await checkSecondaryConfirmCodeRateLimiter.consume(newSecondaryEmail, 1, {
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

  if (
    req.session.pendingSecondaryEmail.confirmCodeExpiresTimestamp < Date.now()
  ) {
    return res.status(403).json({
      message: { key: 'expired_confirmation_code' },
    })
  }

  if (!tsscmp(req.session.pendingSecondaryEmail.confirmCode, code)) {
    return res.status(403).json({
      message: { key: 'invalid_confirmation_code' },
    })
  }

  try {
    await UserAuditLogHandler.promises.addEntry(
      userId,
      'add-email-via-code',
      userId,
      req.ip,
      { newSecondaryEmail }
    )

    await _sendSecurityAlertEmail(user, newSecondaryEmail)

    await UserUpdater.promises.addEmailAddress(
      userId,
      newSecondaryEmail,
      req.session.pendingSecondaryEmail.affiliationOptions,
      {
        initiatorId: user._id,
        ipAddress: req.ip,
      }
    )

    await UserUpdater.promises.confirmEmail(
      userId,
      newSecondaryEmail,
      req.session.pendingSecondaryEmail.affiliationOptions
    )

    delete req.session.pendingSecondaryEmail

    AnalyticsManager.recordEventForUserInBackground(
      user._id,
      'email-verified',
      {
        provider: 'email',
        verification_type: 'token',
        isPrimary: false,
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

    logger.err({ error }, 'failed to check confirmation code')

    return res.status(500).json({
      message: {
        key: 'error_performing_request',
      },
    })
  }
}

async function resendSecondaryEmailConfirmationCode(req, res) {
  if (!req.session.pendingSecondaryEmail) {
    logger.err(
      {},
      'error resending confirmation code. missing pendingSecondaryEmail'
    )

    return res.status(500).json({
      message: {
        key: 'error_performing_request',
      },
    })
  }

  const email = req.session.pendingSecondaryEmail.email

  try {
    await resendSecondaryConfirmCodeRateLimiter.consume(email, 1, {
      method: 'email',
    })
  } catch (err) {
    if (err?.remainingPoints === 0) {
      return res.status(429).json({})
    } else {
      throw err
    }
  }

  try {
    const userId = SessionManager.getLoggedInUserId(req.session)

    await UserAuditLogHandler.promises.addEntry(
      userId,
      'resend-add-email-code',
      userId,
      req.ip,
      {
        newSecondaryEmail: email,
      }
    )

    const { confirmCode, confirmCodeExpiresTimestamp } =
      await UserEmailsConfirmationHandler.promises.sendConfirmationCode(
        email,
        true
      )

    req.session.pendingSecondaryEmail.confirmCode = confirmCode
    req.session.pendingSecondaryEmail.confirmCodeExpiresTimestamp =
      confirmCodeExpiresTimestamp

    return res.status(200).json({
      message: { key: 'we_sent_new_code' },
    })
  } catch (err) {
    logger.err({ err, email }, 'failed to send confirmation code')

    return res.status(500).json({
      key: 'error_performing_request',
    })
  }
}

async function confirmSecondaryEmailPage(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)

  if (!req.session.pendingSecondaryEmail) {
    const redirectURL =
      AuthenticationController.getRedirectFromSession(req) || '/project'
    return res.redirect(redirectURL)
  }

  // Populates splitTestVariants with a value for the split test name and allows
  // Pug to read it
  await SplitTestHandler.promises.getAssignment(req, res, 'misc-b2c-pages-bs5')

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
  const { variant } = await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'auth-pages-bs5'
  )

  const template =
    variant === 'enabled'
      ? 'user/primaryEmailCheck-bs5'
      : 'user/primaryEmailCheck'

  res.render(template)
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

  add: expressify(add),
  addWithConfirmationCode: expressify(addWithConfirmationCode),
  checkSecondaryEmailConfirmationCode: expressify(
    checkSecondaryEmailConfirmationCode
  ),
  resendSecondaryEmailConfirmationCode: expressify(
    resendSecondaryEmailConfirmationCode
  ),

  remove: expressify(remove),

  setDefault: expressify(setDefault),

  endorse(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const email = EmailHelper.parseEmail(req.body.email)
    if (!email) {
      return res.sendStatus(422)
    }

    endorseAffiliation(
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

  resendConfirmation: expressify(resendConfirmation),

  sendReconfirmation: expressify(sendReconfirmation),

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

module.exports = UserEmailsController
