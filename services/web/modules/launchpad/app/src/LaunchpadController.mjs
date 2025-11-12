import OError from '@overleaf/o-error'
import { expressify } from '@overleaf/promise-utils'
import Settings from '@overleaf/settings'
import Path from 'node:path'
import logger from '@overleaf/logger'
import UserRegistrationHandler from '../../../../app/src/Features/User/UserRegistrationHandler.mjs'
import EmailHandler from '../../../../app/src/Features/Email/EmailHandler.mjs'
import UserGetter from '../../../../app/src/Features/User/UserGetter.mjs'
import { User } from '../../../../app/src/models/User.mjs'
import AuthenticationManager from '../../../../app/src/Features/Authentication/AuthenticationManager.mjs'
import AuthenticationController from '../../../../app/src/Features/Authentication/AuthenticationController.mjs'
import SessionManager from '../../../../app/src/Features/Authentication/SessionManager.mjs'
import AdminAuthorizationHelper from '../../../../app/src/Features/Helpers/AdminAuthorizationHelper.mjs'

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
      })
    } else {
      AuthenticationController.setRedirectInSession(req)
      res.redirect('/login')
    }
  } else {
    const user = await UserGetter.promises.getUser(sessionUser._id, {
      isAdmin: 1,
    })
    if (hasAdminAccess(user)) {
      res.render(Path.resolve(import.meta.dirname, '../views/launchpad'), {
        wsUrl: Settings.wsUrl,
        adminUserExists,
        authMethod,
      })
    } else {
      res.redirect('/restricted')
    }
  }
}

async function sendTestEmail(req, res) {
  const { email } = req.body
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

function registerExternalAuthAdmin(authMethod) {
  return expressify(async function (req, res) {
    if (getAuthMethod() !== authMethod) {
      logger.debug(
        { authMethod },
        'trying to register external admin, but that auth service is not enabled, disallow'
      )
      return res.sendStatus(403)
    }
    const { email } = req.body
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

    const body = {
      email,
      password: 'password_here',
      first_name: email,
      last_name: '',
    }
    logger.debug(
      { body, authMethod },
      'creating admin account for specified external-auth user'
    )

    let user
    try {
      user = await UserRegistrationHandler.promises.registerNewUser(body)
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

async function registerAdmin(req, res) {
  const { email } = req.body
  const { password } = req.body
  if (!email || !password) {
    logger.debug({}, 'must supply both email and password, disallow')
    return res.sendStatus(400)
  }

  logger.debug({ email }, 'attempted register first admin user')
  const exists = await _atLeastOneAdminExists()

  if (exists) {
    logger.debug(
      { email: req.body.email },
      'already have at least one admin user, disallow'
    )
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

  const body = { email, password }

  const user = await UserRegistrationHandler.promises.registerNewUser(body)

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
          emails: [{ email, reversedHostname }],
        },
      }
    ).exec()
  } catch (err) {
    OError.tag(err, 'error setting user to admin', {
      user_id: user._id,
    })
    throw err
  }

  logger.debug({ email, userId: user._id }, 'created first admin account')
  res.json({ redir: '/launchpad' })
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
