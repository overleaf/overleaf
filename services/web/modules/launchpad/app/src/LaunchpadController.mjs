import OError from '@overleaf/o-error'
import { expressify } from '@overleaf/promise-utils'
import Settings from '@overleaf/settings'
import Path from 'node:path'
import crypto from 'node:crypto'
import { promisify } from 'node:util'
import logger from '@overleaf/logger'
import UserRegistrationHandler from '../../../../app/src/Features/User/UserRegistrationHandler.mjs'
import EmailHandler from '../../../../app/src/Features/Email/EmailHandler.mjs'
import UserGetter from '../../../../app/src/Features/User/UserGetter.mjs'
import UserSessionsManager from '../../../../app/src/Features/User/UserSessionsManager.mjs'
import { User } from '../../../../app/src/models/User.mjs'
import AuthenticationManager from '../../../../app/src/Features/Authentication/AuthenticationManager.mjs'
import AuthenticationController from '../../../../app/src/Features/Authentication/AuthenticationController.mjs'
import SessionManager from '../../../../app/src/Features/Authentication/SessionManager.mjs'
import AdminAuthorizationHelper from '../../../../app/src/Features/Helpers/AdminAuthorizationHelper.mjs'
import { sanitizeControlCharacters } from '../../../../app/src/infrastructure/Sanitize.mjs'
import { z, parseReq } from '../../../../app/src/infrastructure/Validation.mjs'

const { hasAdminAccess } = AdminAuthorizationHelper

/**
 * Container for functions that need to be mocked in tests
 *
 * TODO: Rewrite tests in terms of exported functions only
 */
const _mocks = {}

_mocks._atLeastOneAdminExists = async () => {
  const user = await UserGetter.promises.getUser(
    { isAdmin: true },
    { _id: 1, isAdmin: 1 }
  )
  return Boolean(user)
}

async function _atLeastOneAdminExists() {
  return await _mocks._atLeastOneAdminExists()
}

function getAuthMethod() {
  if (Settings.ldap) {
    return 'ldap'
  } else if (Settings.saml) {
    return 'saml'
  } else {
    return 'local'
  }
}

async function launchpadPage(req, res) {
  // TODO: check if we're using external auth?
  //   * how does all this work with ldap and saml?
  const sessionUser = SessionManager.getSessionUser(req.session)
  const authMethod = getAuthMethod()
  const adminUserExists = await _atLeastOneAdminExists()

  if (!sessionUser) {
    if (!adminUserExists) {
      res.render(Path.resolve(import.meta.dirname, '../views/launchpad'), {
        adminUserExists,
        authMethod,
        defaultAdminEmailHint: (
          process.env.OVERLEAF_DEFAULT_ADMIN_EMAIL || ''
        ).trim(),
        showThinFooter: true,
      })
    } else {
      AuthenticationController.setRedirectInSession(req)
      res.redirect('/login')
    }
  } else {
    const user = await UserGetter.promises.getUser(sessionUser._id, {
      isAdmin: 1,
      email: 1,
      first_name: 1,
      last_name: 1,
      role: 1,
      institution: 1,
    })
    if (hasAdminAccess(user)) {
      res.render(Path.resolve(import.meta.dirname, '../views/launchpad'), {
        wsUrl: Settings.wsUrl,
        adminUserExists,
        authMethod,
        setupComplete: req.query?.setup === 'complete',
        currentAdmin: {
          email: user.email || '',
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          role: user.role || '',
          institution: user.institution || '',
        },
        hasPackageHubFeature: Boolean(Settings.enablePackageHub),
        showThinFooter: true,
      })
    } else {
      res.redirect('/restricted')
    }
  }
}

const sendTestEmailSchema = z.object({
  // no hidden _csrf field: this form has no such input (see
  // views/launchpad.pug), the CSRF token travels only via the
  // X-Csrf-Token header set by the JSON fetch helper.
  body: z.strictObject({
    email: z.string().optional(),
  }),
})

async function sendTestEmail(req, res) {
  const { body } = parseReq(req, sendTestEmailSchema, { logOnly: true })
  const { email } = body
  if (!email) {
    logger.debug({}, 'no email address supplied')
    return res.status(400).json({
      message: 'no email address supplied',
    })
  }
  logger.debug({ email }, 'sending test email')
  const emailOptions = { to: email }
  try {
    await EmailHandler.promises.sendEmail('testEmail', emailOptions)
    logger.debug({ email }, 'sent test email')
    res.json({ message: res.locals.translate('email_sent') })
  } catch (err) {
    OError.tag(err, 'error sending test email', {
      email,
    })
    throw err
  }
}

const registerExternalAuthAdminSchema = z.object({
  body: z.strictObject({
    email: z.string().optional(),
  }),
})

function registerExternalAuthAdmin(authMethod) {
  return expressify(async function (req, res) {
    if (getAuthMethod() !== authMethod) {
      logger.debug(
        { authMethod },
        'trying to register external admin, but that auth service is not enabled, disallow'
      )
      return res.sendStatus(403)
    }
    const { body } = parseReq(req, registerExternalAuthAdminSchema, {
      logOnly: true,
    })
    const { email } = body
    if (!email) {
      logger.debug({ authMethod }, 'no email supplied, disallow')
      return res.sendStatus(400)
    }

    logger.debug({ email }, 'attempted register first admin user')

    const exists = await _atLeastOneAdminExists()

    if (exists) {
      logger.debug({ email }, 'already have at least one admin user, disallow')
      return res.sendStatus(403)
    }

    const userDetails = {
      email,
      password: crypto.randomBytes(32).toString('hex'),
      first_name: email,
      last_name: '',
      analyticsId: crypto.randomUUID(),
    }
    logger.debug(
      { email, authMethod },
      'creating admin account for specified external-auth user'
    )

    let user
    try {
      user = await UserRegistrationHandler.promises.registerNewUser(userDetails)
    } catch (err) {
      OError.tag(err, 'error with registerNewUser', {
        email,
        authMethod,
      })
      throw err
    }

    try {
      const reversedHostname = user.email
        .split('@')[1]
        .split('')
        .reverse()
        .join('')
      await User.updateOne(
        { _id: user._id },
        {
          $set: { isAdmin: true, emails: [{ email, reversedHostname }] },
        }
      ).exec()
    } catch (err) {
      OError.tag(err, 'error setting user to admin', {
        user_id: user._id,
      })
      throw err
    }

    AuthenticationController.setRedirectInSession(req, '/launchpad')
    logger.debug(
      { email, userId: user._id, authMethod },
      'created first admin account'
    )

    res.json({ redir: '/launchpad', email })
  })
}

export function splitFullName(rawFullName, rawFirstName, rawLastName) {
  const cleanFirst =
    typeof rawFirstName === 'string'
      ? sanitizeControlCharacters(rawFirstName).trim().slice(0, 255)
      : ''
  const cleanLast =
    typeof rawLastName === 'string'
      ? sanitizeControlCharacters(rawLastName).trim().slice(0, 255)
      : ''
  if (cleanFirst || cleanLast) {
    return { first_name: cleanFirst, last_name: cleanLast }
  }
  const cleanFull =
    typeof rawFullName === 'string'
      ? sanitizeControlCharacters(rawFullName).trim().slice(0, 255)
      : ''
  if (!cleanFull) {
    return { first_name: '', last_name: '' }
  }
  const idx = cleanFull.search(/\s+/)
  if (idx === -1) {
    return { first_name: cleanFull, last_name: '' }
  }
  return {
    first_name: cleanFull.slice(0, idx).slice(0, 255),
    last_name: cleanFull.slice(idx).trim().slice(0, 255),
  }
}

async function loginNewlyCreatedAdmin(req, user) {
  const reqLogin = promisify((u, opts, cb) => req.login(u, opts, cb))
  const saveSession = promisify(cb => req.session.save(cb))
  await reqLogin(user, { keepSessionInfo: true })
  delete req.session.__tmp
  delete req.session.csrfSecret
  req.session.analyticsId = user.analyticsId
  await saveSession()
  UserSessionsManager.trackSession(user, req.sessionID, () => {})
}

export const registerAdminSchema = z.object({
  body: z.strictObject({
    email: z.string().trim().min(1).max(254).optional(),
    password: z.string().min(1).max(256).optional(),
    confirm_password: z.string().max(256).optional(),
    full_name: z.string().max(255).optional(),
    first_name: z.string().max(255).optional(),
    last_name: z.string().max(255).optional(),
    role: z.string().max(120).optional(),
    institution: z.string().max(160).optional(),
    _csrf: z.string().optional(),
  }),
})

async function registerAdmin(req, res) {
  let body
  try {
    ;({ body } = parseReq(req, registerAdminSchema))
  } catch {
    return res.status(400).json({
      message: { type: 'error', text: 'Invalid account details supplied' },
    })
  }
  const { email, password, confirm_password } = body
  if (!email || !password) {
    logger.debug({}, 'must supply both email and password, disallow')
    return res.status(400).json({
      message: {
        type: 'error',
        text: 'Please provide both an email address and password',
      },
    })
  }
  if (
    confirm_password != null &&
    confirm_password !== '' &&
    confirm_password !== password
  ) {
    return res.status(400).json({
      message: { type: 'error', text: 'Passwords do not match' },
    })
  }

  logger.debug({ email }, 'attempted register first admin user')
  const exists = await _atLeastOneAdminExists()

  if (exists) {
    logger.debug({ email }, 'already have at least one admin user, disallow')
    return res.status(403).json({
      message: { type: 'error', text: 'admin user already exists' },
    })
  }

  const invalidEmail = AuthenticationManager.validateEmail(email)
  if (invalidEmail) {
    return res
      .status(400)
      .json({ message: { type: 'error', text: invalidEmail.message } })
  }

  const invalidPassword = AuthenticationManager.validatePassword(
    password,
    email
  )
  if (invalidPassword) {
    return res
      .status(400)
      .json({ message: { type: 'error', text: invalidPassword.message } })
  }

  const parsedName = splitFullName(
    body.full_name,
    body.first_name,
    body.last_name
  )
  const role =
    typeof body.role === 'string'
      ? sanitizeControlCharacters(body.role).trim().slice(0, 120)
      : ''
  const institution =
    typeof body.institution === 'string'
      ? sanitizeControlCharacters(body.institution).trim().slice(0, 160)
      : ''

  const userDetails = {
    email,
    password,
    ...(parsedName.first_name ? { first_name: parsedName.first_name } : {}),
    ...(parsedName.last_name ? { last_name: parsedName.last_name } : {}),
    analyticsId: crypto.randomUUID(),
  }

  const user =
    await UserRegistrationHandler.promises.registerNewUser(userDetails)

  logger.debug({ userId: user._id }, 'making user an admin')

  try {
    const reversedHostname = user.email
      .split('@')[1]
      .split('')
      .reverse()
      .join('')
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          isAdmin: true,
          first_name: parsedName.first_name || user.first_name,
          last_name: parsedName.last_name || '',
          role,
          institution,
          emails: [{ email: user.email, reversedHostname }],
        },
      }
    ).exec()
  } catch (err) {
    OError.tag(err, 'error setting user to admin', {
      user_id: user._id,
    })
    throw err
  }

  try {
    const freshUser = await User.findById(user._id).exec()
    if (freshUser && typeof req.login === 'function') {
      await loginNewlyCreatedAdmin(req, freshUser)
    }
  } catch (err) {
    logger.warn({ err, userId: user._id }, 'auto-login after admin setup failed')
  }

  logger.debug({ email, userId: user._id }, 'created first admin account')
  res.json({ redir: '/launchpad?setup=complete' })
}

const LaunchpadController = {
  launchpadPage: expressify(launchpadPage),
  registerAdmin: expressify(registerAdmin),
  registerExternalAuthAdmin,
  sendTestEmail: expressify(sendTestEmail),
  _atLeastOneAdminExists,
  _mocks,
}

export default LaunchpadController
